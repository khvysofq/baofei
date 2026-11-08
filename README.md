# 报废车参考收购价

四川地区报废车参考收购价工具。用户只填 17 位车辆识别代号（VIN），按当地回收行情与整备质量
估算参考收购区间。只凭 VIN 估算，不验车、不采集证件、不上传照片，结果不构成实际报价。

线上：<https://baofei.publicrandom.com>

## 现在有什么

| 路由 | 作用 |
| --- | --- |
| `/` | 唯一对外页面：VIN 输入 → 参考收购价报告 |
| `/guanli` | 隐藏后台（不在导航中），登录后可改定价配置 |
| `/guanli/tongji` | 后台统计：访问、VIN 查询量、渠道调用额度、最近查询 |

接口：`POST /api/valuation/analyze`（仅 JSON `{vin}`）、`POST /api/track`（匿名访问埋点）、
`GET /api/health`、`/api/guanli/{login,logout,pricing,stats}`。

> 2026-11-08：早期「报废办理助手」流程（`/start` `/plan` `/documents` `/quotes`
> `/appointment` `/case` `/subsidy`）已从代码中删除，包括对应页面、接口、
> `lib/services`、`lib/rules` 与测试。产品收敛为单一的 VIN 估价工具。

## 估价链路

1. **校验**：按 GB 16735 校验 17 位、字符集、第 9 位校验码，不合法直接 400，不调用渠道。
   `VIN_CHECK_DIGIT=off` 可放宽模 11。
2. **查车型**：走真实第三方车型库（默认极速车服），取品牌、车系、年款、整备质量、座位数、
   能源类型。渠道无结果返回 404，渠道故障降级演示并给 `notice`，不编造车型。
3. **算价**：唯一一套定价逻辑在 `src/lib/valuation/pricing.ts`。按车型档位吨价 × 整备质量
   算车值，再扣缺件、拖运与服务费，输出参考到手区间。车值与服务费分区展示。
4. **重算**：报告里的选项（铝圈/铁轮毂、拖运/自行送车、缺件数量、部件齐全确认）在浏览器端
   用同一份纯函数即时重算，不请求接口。

数据口径：VIN 车型档案 30 天内命中缓存不重复计费；报价每次重算。整备质量缺失时不给总价，
提示现场地磅称重，不使用兜底重量。电动/混动按整车吨价估算，动力电池需现场检测，不单独计价。

## 渠道与防刷

- 渠道层 `src/lib/vin/`：`VinProvider` 接口 + `VIN_PROVIDER_ORDER` 优先级 + 重试降级。
  新增渠道只需在 `providers/` 实现并注册，业务只调 `queryVin()`。见 `docs/vin-providers.md`。
- 单 IP 限流：`VIN_RATE_LIMIT_PER_MINUTE` / `_HOUR` / `_DAY`（默认 8 / 40 / 120）。
- 每日渠道预算：`VIN_DAILY_CALL_LIMIT`（默认 5000 次/天），只有缓存未命中才计数。
- 紧急开关：`VIN_KILL_SWITCH=1` 停止调用渠道，缓存仍可用。

## 目录

```
src/app/                 页面与接口（/、/guanli、/api/valuation、/api/track、/api/guanli）
src/components/valuation 估价表单与报告
src/components/admin     后台定价与统计
src/components/analytics 匿名访问埋点
src/lib/valuation/       定价（pricing.ts）、配置存取、车型档案
src/lib/vin/             车型渠道、缓存、预算与日志
src/lib/domain/          纯函数：金额（整数分）、地区、任务、状态、版本
src/lib/                 数据库、缓存、存储、限流、后台鉴权、埋点
db/migrations/*.sql      只增不改
tests/                   vitest 单测（不含依赖真实库的集成测试）
scripts/                 migrate / seed / copy / package-standalone / smoke
```

## 本地开发

```bash
pnpm install
node scripts/db-migrate.mjs          # 幂等迁移
node scripts/db-seed.mjs             # 种子（可选，本地演示用）
pnpm dev --port 10802
```

`.env.local`（0600，gitignored）需要渠道 appkey 等凭据，不要提交或打印。

## 后台

`/guanli` 不在导航中。用 `ADMIN_PASSWORD` 登录，可选 `ADMIN_SESSION_SECRET` 作为会话签名密钥
（未设置时使用 `ADMIN_PASSWORD`）。未配置密码时页面显示设置说明，`/api/guanli/*` 返回 503。

可编辑：行情参考（只展示）、行情联动系数、车型吨价表、缺件扣款目录、拖运/服务费、区间参数；
保存后发布为新版本，旧版本留历史。金额按元填写，保存时换算为整数分。

## 部署

单机 standalone + PGlite，systemd 托管，Nginx 反代到 `127.0.0.1:18012`。
完整步骤与回滚见 `docs/deploy-cloud.md`。

## 已知边界

- 回收行情、吨价表、扣款目录均为可配置项，需人工核对当期市场。
- 未验车、未称重，结果只作参考，不构成报价承诺。
- 报废车回收拆解需资质，站内表述限于「参考估价 / 信息咨询」。