# VIN 查询渠道层

> 目标：渠道可插拔。业务代码只认 `queryVin()`，换渠道不改估值引擎与页面。

## 目录

```
src/lib/vin/
  types.ts              统一档案 VinVehicleSpec + 错误码 + VinProvider 接口
  normalize.ts          VIN 校验、数字/车价/排放归一化、车型分类
  index.ts              渠道注册、优先级路由、缓存、重试、降级
  log.ts                调用日志（命中率/延迟/成本），写库失败不影响查询
  providers/
    jisuepc.ts          极速车服 https://www.jisuepc.com/api/vin/
```

估值引擎 `src/lib/valuation/engine.ts` 只接收 `VinVehicleSpec`；没有档案就走原有 WMI/年款推定，
并把它标成 `dataSource.kind = "demo"`。

## 路由顺序

`queryVin(vin)` 的行为：

1. 本地 17 位校验（`A–H J–N P–Z 0–9`，不含 I/O/Q）。
2. 负缓存：10 分钟内查过且全部渠道无结果，直接返回 `NOT_FOUND`，不重复计费。
3. 按 `VIN_PROVIDER_ORDER` 顺序遍历已配置渠道：
   - 先查 30 天成功缓存（key `baofei:vin:v1:spec:<provider>:<vin>`）；
   - 未命中则调渠道；`TIMEOUT` / `NETWORK` / `UPSTREAM_ERROR` / `RATE_LIMITED` / `BAD_RESPONSE` 才允许重试（默认 0 次，按次计费接口别乱重试）；
   - 渠道报错或 `NOT_FOUND` 就切下一个渠道。
4. 全部失败：
   - 都是 `NOT_FOUND` → 抛 `NOT_FOUND`（用户需要核对 VIN）；
   - 其他 → 抛 `UPSTREAM_ERROR`。API 层据此决定「明确拒绝」还是「降级演示推定 + 提示」。

## 环境变量

| 变量 | 默认 | 说明 |
|---|---|---|
| `VIN_PROVIDER_ORDER` | 全部已注册渠道 | 逗号分隔，按优先级 |
| `VIN_TIMEOUT_MS` | 6000 | 单次渠道调用超时 |
| `VIN_CACHE_TTL_SECONDS` | 2592000（30 天） | VIN→车型基本不变 |
| `VIN_MISS_TTL_SECONDS` | 600 | 无结果负缓存，防刷额度 |
| `VIN_DEBUG_RAW` | 0 | 1 = 把渠道原始返回写进 `vin_lookups.raw` |
| `JISUEPC_APPKEY` | 空 | 极速车服 appkey；为空则该渠道视为未配置 |
| `JISUEPC_BASE_URL` | `https://api.jisuepc.com` | 便于切测试环境 |
| `JISUEPC_STRICT` | 0 | 1 = 让渠道严格校验 VIN |

未配置任何渠道时，`queryVin` 抛 `NOT_CONFIGURED`，API 层降级为演示推定，页面照常出报告但会标注。

## 新增一个渠道

1. 新建 `src/lib/vin/providers/<id>.ts`，实现 `VinProvider`：

```ts
import type { VinProvider, VinProviderResult, VinQueryContext } from "../types";

export const yourProvider: VinProvider = {
  id: "yourchannel",
  label: "渠道中文名",
  costFenPerQuery: 10, // 单次成本（分），用于统计；未知填 null

  isConfigured() {
    return Boolean(process.env.YOURCHANNEL_KEY?.trim());
  },

  async query(vin, context: VinQueryContext): Promise<VinProviderResult> {
    // 1. 用 context.timeoutMs 建 AbortSignal.timeout，并合并 context.signal
    // 2. fetch 渠道接口
    // 3. 非成功状态码抛 VinQueryError（务必标 retryable）
    // 4. 把字段映射成 spec，返回 { spec, raw }
  },
};
```

2. 在 `src/lib/vin/index.ts` 的 `PROVIDERS` 数组里加入（或在模块加载时 `registerVinProvider()`）。
3. 在 `VIN_PROVIDER_ORDER` 里排优先级。
4. 字段映射统一用 `normalize.ts` 的 `parseNumber` / `parsePriceFen` / `normalizeEmission` /
   `classifyVehicle`，不要各渠道各写一套。
5. 补单测：mock `fetch` 验证字段映射 + 错误码映射（参考 `tests/vin.test.ts`）。

渠道专属怪癖写在该 provider 文件顶部的注释里，例如极速车服的 `status` 有时是数字 `0`、有时是字符串
`"210"`，且不校验 VIN 长度（16 位也能返回数据）。

## 错误码映射约定

业务错误码见 `types.ts` 的 `VinErrorCode`：

- `NOT_FOUND` — 渠道没有这辆车（换渠道有意义）
- `INVALID_VIN` — 渠道判定 VIN 不合法（不再重试本渠道）
- `UNAUTHORIZED` / `QUOTA_EXCEEDED` / `IP_BLOCKED` / `RATE_LIMITED` / `MAINTENANCE` — 渠道侧故障（换渠道有意义）
- `TIMEOUT` / `NETWORK` / `UPSTREAM_ERROR` / `BAD_RESPONSE` — 传输层问题（可重试一次）
- `NOT_CONFIGURED` — 本地没配 key

极速车服状态码对照：201/202 → `INVALID_VIN`，210 → `NOT_FOUND`，101/102/103 → `UNAUTHORIZED`，
104 → `QUOTA_EXCEEDED`，105 → `IP_BLOCKED`，106 → `RATE_LIMITED`，107/108 → `MAINTENANCE`。

## 运行数据

`db/migrations/002_vin_lookups.sql` 建了 `vin_lookups`，每次真实调用/缓存命中都记一行：

```sql
-- 近 7 天各渠道命中率与成本
SELECT provider,
       count(*) FILTER (WHERE status = 'hit')  AS hits,
       count(*) FILTER (WHERE status = 'miss') AS misses,
       count(*) FILTER (WHERE status = 'error') AS errors,
       round(avg(latency_ms) FILTER (WHERE status = 'hit')) AS avg_ms,
       round(sum(cost_fen) / 100, 2) AS cost_yuan
FROM vin_lookups
WHERE created_at > now() - interval '7 days'
GROUP BY provider;
```

## 已知边界

- 极速车服只给「车型年款」，不给首次登记日期与使用性质；这两项仍由用户/行驶证补齐，报告里标注推定。
- 热门冷门车、改装车、进口车可能无结果或多候选；当前取渠道首选车型，报告会提示现场核验。
- 残值系数（废钢比例、三元催化、可回用件溢价）是公开规则估算，不是回收企业实时报价。