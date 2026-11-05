# 报废车参考收购价

免费获客页：用户只填 17 位车辆识别代号（VIN），按回收企业吨价表估算参考收购区间。
只凭 VIN 估算，不验车、不采集证件、不上传照片，结果不构成实际报价。

1. 输入 VIN 后先按 GB 16735 校验（17 位、字符集、第 9 位校验码），不合法不调渠道。
2. VIN 走真实第三方车型库（默认极速车服），取回品牌、车系、年款、整备质量、座位数与能源类型。
   渠道无结果或不可用时**明确报错**，不再用 WMI / 预设车型编造品牌与重量。
3. 唯一一套定价系统：`src/lib/valuation/pricing.ts`。按车型档位吨价 × 整备质量算车值，
   再扣缺件、拖运与服务费，输出参考到手区间。车值与服务费分成两个区展示。
4. 报告所有选项（铝圈 / 铁轮毂、拖运 / 自行送车、缺件数量、部件齐全确认）都在浏览器端
   用同一份纯函数即时重算，不额外请求接口。

数据说明：VIN 车型档案来自第三方渠道，30 天内命中缓存不重复计费；报价每次重算。
整备质量缺失时不给总价，提示现场地磅称重，绝不使用编造的兜底重量。
电动 / 混动仍按整车吨价估算，动力电池需现场检测，不单独计价。
VIN 位置与 17 位规则以输入框下方的「VIN 在哪里看？」折叠说明展示，不单独设页面。

入口 `/`，接口 `POST /api/valuation/analyze`（仅 JSON `{vin}`，照片上传返回 415）。
定价模型 `src/lib/valuation/pricing.ts`，持久层 `src/lib/valuation/pricing-store.ts`，
渠道层 `src/lib/vin/`。旧残值引擎 `src/lib/valuation/engine.ts` 已标记 `@deprecated`，不再进入用户面。

## 定价后台

`/guanli` 是隐藏页，不在导航中。用环境变量 `ADMIN_PASSWORD` 登录；可选的
`ADMIN_SESSION_SECRET` 作为会话签名密钥（未设置时使用 `ADMIN_PASSWORD`）。未配置密码时，
`/guanli` 显示设置说明，`/api/guanli/*` 返回 503。

```bash
ADMIN_PASSWORD=改成你自己的密码
# 可选
ADMIN_SESSION_SECRET=单独的长随机串
```

后台可编辑：行情参考（只展示，不参与计算）、行情联动系数（对全部吨价统一上浮 / 下调）、
车型吨价表、缺件扣款目录、拖运 / 服务费、区间参数；保存后发布为新版本，旧版本留历史。金额在后台按元填写，保存时换算为整数分。
`db/migrations/003_pricing_config.sql` 建 `pricing_configs` 表；数据库不可用时公开页回退到
`DEFAULT_PRICING`，不阻塞估价。

> 以下为早期“报废办理助手”流程（`/start` `/plan` …），保留可独立访问，首页已不再链接。

# 早期：四川汽车报废办理助手 · Demo

一个可真实点击、刷新不丢、可重置、可注入阶段的报废办理演示。7 个页面 + 3 个固定场景（S1/S2/S3），
确定性规则引擎，全程 **演示模式**：不接真实政务、企业或支付接口，不采集真实证件。

规格：`docs/spec-scrap-demo-v1.1.md`（功能以它为准）· 约定：`CLAUDE.md`。

## 快速开始

前置：Postgres 18、Valkey 9、Garage S3 已就绪，`.env.local` 已有
`DATABASE_URL`、`REDIS_URL`、`REDIS_KEY_PREFIX`、`S3_*`（不要提交或打印这些值）。

```bash
pnpm install
node scripts/db-migrate.mjs     # 幂等迁移（schema_migrations）
node scripts/db-seed.mjs        # 重建 demo-sc-v1.1 种子；可重复跑
pnpm dev --port 10802           # http://127.0.0.1:10802
```

### 轻量模式（无 Postgres / Redis / S3）

不配 `DATABASE_URL`、`REDIS_URL`、`S3_ENDPOINT` 时会自动使用：嵌入式 Postgres
（PGlite，数据在 `.data/pglite`）、进程内存缓存、本地生成的样例 SVG。适合单机小内存部署。

```bash
DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite node scripts/db-migrate.mjs
DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite node scripts/db-seed.mjs
pnpm dev --port 10802
```

已有 Postgres 数据可以整表搬到 PGlite：

```bash
DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite node scripts/db-migrate.mjs
DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite node scripts/db-seed.mjs
node scripts/db-copy.mjs --data-dir .data/pglite   # 源库读 .env.local 的 DATABASE_URL
```

生产构建：

```bash
pnpm build
pnpm start -p 10802
```

端口固定 **10802**，不要占用 3000。

### 验证命令

```bash
pnpm lint
pnpm test                       # vitest：domain / rules / 状态机 / 服务级验收
node scripts/smoke.mjs          # 7 路由 + /api/health；未启动时会临时拉起 dev
```

> ⚠️ `pnpm test` 会连 `.env.local` 的数据库，且 `tests/api.test.ts` 结束时会 `resetAllDemo()`
> 清空业务表（案件/报价/任务/事件）。跑之前先备份或改用独立测试库。

`smoke.mjs` 默认检查 `http://127.0.0.1:10802`，可用 `SMOKE_BASE_URL` 覆盖。

## 演示路径

1. `/start` 输入一句话，或点“成都演示案例”填入示例，再按“生成我的办理计划”。
2. `/plan` 逐项确认/修改；改值立即重算任务与下一步。
3. `/documents` 选择“演示资料 1/2/3”。资料 2 局部模糊，资料 3 的登记日期与提取值不一致；
   修正后才允许确认。登记证找不到可建立核对任务。
4. `/quotes` 比较演示回收方 A/B：A 净额 1000 元，B 净额 1050 元。
5. `/appointment` 选时段、停车点与交接人，确认模拟预约（重复点击只生成一张）。
6. `/case` 查看四条独立状态与凭证；提供注销证明只到“已提供 待核验”。
7. `/subsidy` 仅在换新时启用；输出“资格待核实”与缺项，不计算补贴金额。
8. 右下角“演示控制”可注入 D1–D7、记录付款通知、重置、导出测试记录 JSON。

场景：S1 常规报废 · S2 登记证缺失 · S3 报废并换新；另有省内跨市州、跨省、只填“四川”等分诊样例。

## 技术结构

```
src/app/                 7 个页面 + API route handlers
src/components/          HUD 外壳、演示控制、任务卡、状态灯、金额、面板
src/lib/domain/          纯函数：金额（整数分）、地区、任务顺序、状态、版本失效
src/lib/rules/           确定性分诊（先否定词后关键词）
src/lib/services/        适配层：分诊、案件、材料、报价、预约、事件、补贴、协助
src/lib/fixtures → db/   demo-sc-v1.1 种子 JSON
db/migrations/*.sql      只增不改
tests/                   vitest 单测 + 服务级验收（A09/A11–A15 等）
scripts/                 migrate / seed / smoke
```

### 页面与路由

`/start` `/plan` `/documents` `/quotes` `/appointment` `/case` `/subsidy`；
API 前缀 `/api`：`intake/parse`、`cases`、`case`、`case/fields`、`case/confirm`、
`documents`、`documents/sample|confirm|mismatch|missing`、`documents/[id]/asset`、
`quotes`、`quotes/select`、`appointments`、`appointments/confirm|cancel`、
`tasks/resolve`、`evidence`、`subsidy`、`help`、`demo`、`payment/confirm`、`health`。

## 中间件用法

### Postgres（`pg`）

| 表 | 存什么 |
|---|---|
| `cases` | 案件、场景、`profileVersion` / `materialsVersion`、当前报价选择、交接时间 |
| `case_fields` | 6 个确认字段的 `value/source/confirmed/confidence`；unknown 存 JSON null |
| `vehicles` | 演示车辆 `DEMO VEHICLE 01`、号牌掩码、使用性质 |
| `documents` | 材料类型、所选样例、提取字段、问题区域、确认状态 |
| `tasks` | 11 级任务、状态、解决说明绑定的版本与地区 |
| `quotes` | 两家演示报价的每个版本；金额整数分，未知费用 `NULL`，旧版本保留 |
| `appointments` | 预约摘要与 quote/profile/materials 三个版本、`idempotency_key` |
| `evidence` | caseId + vehicleId + type 唯一归属，跨案引用拒绝 |
| `subsidy_contexts` | 计划/发票地区、登记省份、受理市州、材料类别 |
| `city_policy_config` | 国家/四川省/成都规则分层、来源编号、核对日期、成都别名 |
| `events` | append-only，含 `sequence/source/demo`；数据库触发器禁止 UPDATE/DELETE |
| `scenario_templates` / `document_samples` / `quote_templates` | demo-sc-v1.1 固定配置 |

种子与重置：`node scripts/db-seed.mjs` 清空后重建；演示控制“重置”清空业务表，
配置表和 S3 样例保留，报价版本回到 v1。

### Valkey / Redis（`ioredis`）

- 解析缓存：`baofei:parse:<sha256>`，TTL 10 分钟，响应区分 `source: "rule" | "cache"`。
- 预约幂等：`baofei:idem:<key>`，TTL 24 小时；数据库 `UNIQUE(case_id, idempotency_key)` 兜底。
- 重置时按前缀清理 `baofei:parse:*` 与 `baofei:idem:*`。
- 缓存不可用时自动降级，不影响业务。

### S3 / Garage（`@aws-sdk/client-s3`）

- 桶 `baofei`，键 `demo-sc-v1.1/samples/DOC_CLEAR|DOC_BLUR|DOC_MISMATCH.svg`。
- 三张卡面由 `src/lib/storage.ts` 用 SVG 生成（含 DEMO VEHICLE 01、模糊滤镜、固定日期差异），
  首次访问或 `/api/health` 时若对象缺失则幂等上传。
- `/api/documents/[id]/asset` 流式返回，`image/svg+xml`。不含真实证件。

## 与规格的差异

1. **持久化**：规格 14 节默认 `sessionStorage`；本实现按要求改为服务端 Postgres 持久化，
   浏览器只存 `caseId`（localStorage + cookie）。刷新不丢，重置回到同一 seed。
2. **主题**：规格 09 节建议浅色底；本项目按 `CLAUDE.md` 的设计系统使用暗色“废土科技风”。
   信息层级与文案仍按规格；正文 16px、点击目标 ≥ 44px、焦点可见、状态不只靠颜色。
3. **AI**：首版按规格使用确定性规则解析，不接大模型；接口边界保留在 `services/parse.ts`。
4. **预算/进度**：不显示总完成百分比；只显示四条独立状态与显式事件。
5. **缺证解决**：本版演示规则要求“核对说明 + 材料确认”才能预约，不代表真实法律门槛。

## 容器部署

`docker-compose.yml` 使用外部 `shared` 网络与 `env_file: /srv/apps/baofei/.env`。
容器内的 `DATABASE_URL` / `REDIS_URL` / `S3_ENDPOINT` 应指向 `postgres:5432`、
`valkey:6379`、`garage:3900`（部署环境文件负责，不在仓库写死连接串）。

## 单机部署（standalone + PGlite）

云端小内存机器不需要单独的数据库、缓存、对象存储进程：`output: "standalone"` 打包后由
systemd 直接运行 `node server.js`，业务数据落在 `PGLITE_DATA_DIR`。完整步骤见
`docs/deploy-cloud.md`。

## 已知边界 / 需人工确认

- 真实企业资质、报价行情、时段、政务受理细节、补贴当期开放情况均为演示配置，需人工核对。
- 除成都外的四川市州只显示“本地规则待核实”，不套用成都要求。
- 手机重点检查 390px、最小 320px；桌面 1280px 两栏/2×2。建议在真机再做一次键盘与读屏检查。