# CLAUDE.md — baofei 项目约定

四川地区「报废车参考收购价」工具。产品只做一件事：**输入 VIN，给出参考收购价区间**。
本文件补充技术栈、目录、设计系统与硬性约束。

## 一句话

单页应用：首页填 17 位 VIN → 校验 → 查真实车型库 → 按吨价表与整备质量算车值 → 扣缺件/拖运/服务费
→ 输出参考到手区间。另有隐藏后台 `/guanli`（定价配置）与 `/guanli/tongji`（访问与查询统计）。
不采集证件，不接政务/支付接口。

> 2026-11-08：早期「报废办理助手」7 页流程（/start /plan /documents /quotes /appointment /case /subsidy）
> 连同 `lib/services`、`lib/rules`、demo 注入、案件状态机已整体删除。不要再引用它们。
> 历史规格 `docs/spec-scrap-demo-v1.1.md` 仅作归档，不是现状。

## 技术栈（已定，不要替换）

- Next.js 16 App Router + TypeScript strict + Tailwind CSS 4（在 `globals.css` 里 `@import`）
- 数据库：Postgres 18（`pg`）或 PGlite（单机部署），由 `src/lib/db.ts` 统一封装双驱动
- 缓存：`src/lib/cache.ts` 支持 redis / db / 内存三种后端（云端用 `db`，即 PGlite 表 `cache_entries`）
- 存储：`src/lib/storage.ts`，无 `S3_ENDPOINT` 时本地生成样例 SVG
- 测试：vitest；脚本：`scripts/*.mjs`（Node 原生）

**不要引入**：UI 组件库（antd/MUI/shadcn）、状态管理库、ORM（prisma/drizzle）、动画库、图表库。

## 常用命令

```bash
pnpm dev --port 10802               # 本地开发
pnpm build && pnpm start -p 10802   # 生产构建
pnpm lint
pnpm test                           # vitest 单测（纯函数为主，不写库）
node scripts/db-migrate.mjs         # 幂等迁移，可重复跑
node scripts/db-seed.mjs            # 写种子（会清业务表，生产环境慎用）
node scripts/package-standalone.mjs # 组装 .deploy/baofei
```

端口 10802。3000 端口是别的项目，别碰。

> ⚠️ `tests/setup.ts` 会加载 `.env.local`。跑会写库的测试前先 `pg_dump` 或指向独立测试库。
> 2026-10-31 曾在生产库上被清过一次业务表。

## 目录

```
src/app/page.tsx                首页（VIN 估价）
src/app/guanli/                 后台：定价配置、统计
src/app/api/valuation/analyze   VIN 估价接口（只收 JSON {vin}）
src/app/api/track               匿名访问埋点（visitor_id cookie，不记 IP）
src/app/api/guanli/*            后台登录、定价、统计
src/components/valuation/       估价表单与报告（报告内选项浏览器端重算）
src/components/admin/           后台定价与统计界面
src/lib/valuation/pricing.ts    唯一一套定价逻辑
src/lib/valuation/pricing-store  定价配置读写（pricing_configs 表，未配置回退默认）
src/lib/vin/                    渠道层：类型、归一化、路由、预算、日志、providers/
src/lib/domain/                 纯函数：金额（整数分）、地区、状态、任务、版本
src/lib/db.ts / cache.ts / storage.ts / security/ / admin/ / analytics/
db/migrations/*.sql             只增不改
tests/                          vitest 单测
scripts/                        migrate / seed / copy / package-standalone / smoke
```

## 数据与环境

`.env.local`（0600，gitignored）含 `DATABASE_URL` `S3_*`、VIN 渠道 appkey（`JISUEPC_APPKEY`）、
后台密码等。**不要打印、提交或修改其中密钥**；不要在代码里写死连接串。

云端事实：`/srv/apps/baofei`，数据 `/var/lib/baofei/pglite`，systemd `baofei.service`，
Nginx `baofei.publicrandom.com` → `127.0.0.1:18012`。详见 `docs/deploy-cloud.md`。
端口选择要避开 frps 占用的 10800–11000 与 22000–22100。

## 领域硬约束（违反即返工）

1. 金额一律**整数分**存库与计算，仅展示时换算元；未知费用是 `null`，**不能当 0**。
2. VIN 必须先过 `validateVin()`（GB 16735：17 位 / 字符集 / 第 9 位校验码 / 年份位）再调渠道；
   不合法直接 400，不查缓存、不计费。
3. 整备质量缺失时不给总价，提示现场地磅称重。**绝不用编造或兜底的重量**。
4. 渠道无结果返回 404；渠道故障可降级演示但必须带 `notice`，不得伪装成真实查询结果。
5. 报告里的车型档案缓存 30 天，但报价每次重算；缓存命中不计渠道成本。
6. 渠道预算用 `provider_usage` 原子预占，只有缓存未命中才计数；`VIN_KILL_SWITCH=1` 可紧急停渠道。
7. 单 IP 限流按分钟/小时/天三层；超限 429，预算超限 503，已缓存 VIN 仍可查。
8. 前台只展示「参考区间」，措辞不能写成承诺报价；不出现「一定能领补贴」「马上注销」。
9. 后台改价必须发布为新版本，旧版本留历史；金额在后台按元填、存整数分。

## 设计系统：浅色服务感

基调：米白底 + 墨绿主色 + 铜橙强调，信息优先、可读性不让步。不要暗色废土风、不要霓虹、不要玻璃拟态。

**色板**（定义在 `globals.css` 的 `@theme`，页面只用语义类名，不写死十六进制）

| 变量 | 值 | 用途 |
|---|---|---|
| `--color-void` | `#f6f7f5` | 页面底 |
| `--color-panel` | `#ffffff` | 卡片/面板 |
| `--color-raise` | `#f1f3f1` | 输入框、浮层 |
| `--color-line` | `#e3e6e2` | 常规描边 |
| `--color-line-strong` | `#cbd2cd` | 强调描边、分隔 |
| `--color-text` | `#14181a` | 主文本 |
| `--color-dim` | `#5c6663` | 次要文本 |
| `--color-brand` | `#0f6b57` | 主色：主按钮、链接、当前状态 |
| `--color-brand-soft` | `#e8f2ee` | 主色浅底 |
| `--color-rust` | `#c2410c` | 强调数字、标签 |
| `--color-acid` | `#0f766e` | 已核验/在线状态 |
| `--color-warn` | `#b45309` | 待核实 |
| `--color-danger` | `#b42318` | 错误、冲突 |

圆角上限 `--radius-card: 14px`；阴影用 `--shadow-card` / `--shadow-pop`。
标签/编号/金额用 mono + `tabular-nums`；正文 16px，行高宽松。

**布局**：手机优先（重点 390px，最小 320px），桌面两栏。点击目标 ≥ 44px，
`:focus-visible` 可见描边，状态不只靠颜色表达，动效遵循 `prefers-reduced-motion`。

## 文案

中文、直白、动词开头。用「车辆识别代号（VIN）」「参考区间」「预计到手」「还需核对」。
禁止：夸张营销词、保证性承诺、把估算结果写成官方或渠道确认的结果。

## 交付习惯

- 每个工作包一次提交，中文 commit message，说明改了什么、怎么验证的。
- 改动后必跑 `pnpm exec tsc --noEmit`、`pnpm build`；涉及纯函数逻辑补 `pnpm test`。
- 不许留 `console.log`、假的 TODO 文案、「即将上线」占位。