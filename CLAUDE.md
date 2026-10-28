# CLAUDE.md — baofei 项目约定

四川汽车报废办理助手 Demo。产品规格以 `docs/spec-scrap-demo-v1.1.md` 为准（下称"规格"），
本文件补充技术栈、目录、设计系统与硬性约束。冲突时：规格 > 本文件 > 你的习惯。

## 一句话

7 个页面（/start /plan /documents /quotes /appointment /case /subsidy）+ 3 个固定场景（S1 S2 S3），
确定性规则引擎，全程"演示模式"，不接真实政务/企业接口，不采集真实证件。

## 技术栈（已定，不要替换）

- Next.js 16 App Router + TypeScript strict + Tailwind CSS 4（Tailwind 已在 `src/app/globals.css` 里 `@import`）
- Postgres 18（`pg`）、Valkey 9（`ioredis`）、Garage S3（`@aws-sdk/client-s3`）
- 状态：服务端持久化到 Postgres；浏览器只存 `caseId`
- 测试：vitest；脚本：`scripts/*.mjs`（Node 原生，不经 tsx）

**不要引入**：UI 组件库（antd/MUI/shadcn）、状态管理库（redux/zustand）、ORM（prisma/drizzle）、
动画库（framer-motion）、图表库。用 React + Tailwind + 少量原生 CSS 完成。

## 常用命令

```bash
pnpm dev --port 10802          # 本地开发
pnpm build && pnpm start -p 10802   # 生产构建
pnpm lint
pnpm test                      # vitest run
node scripts/db-migrate.mjs    # 幂等迁移，可重复跑
node scripts/db-seed.mjs       # 重建 demo-sc-v1.1 种子（清空业务表后写入）
node scripts/smoke.mjs         # 7 个路由冒烟
```

端口 10802。3000 端口是别的项目，别碰。

## 目录

```
src/app/                 路由与页面（每页一个 page.tsx + 页面私有组件）
src/app/api/             route handlers（解析、案件、材料、报价、预约、事件、演示控制）
src/components/          跨页组件（任务卡、状态灯、金额、HUD 外壳、演示标识）
src/lib/domain/          纯函数：金额、状态机、任务排序、版本失效、不变量校验
src/lib/rules/           分诊规则、地区归一化、主任务选择、四川规则映射
src/lib/services/        适配层（parseIntake / inspectSample / evaluatePlan / listQuotes /
                         confirmAppointment / appendDemoEvent / getEvidence），API 与页面只经这里
src/lib/db.ts            pg 连接池 + 事务助手
src/lib/cache.ts         ioredis 客户端（键必须带 baofei: 前缀）
src/lib/storage.ts       S3 客户端（端点读 S3_ENDPOINT）
src/fixtures/            demo-sc-v1.1 场景、报价、材料、阶段事件
db/migrations/*.sql      只增不改
tests/                   vitest 单测（domain 与 rules 必测）
```

## 数据与环境

`.env.local`（0600，已 gitignore）含 `DATABASE_URL` `REDIS_URL` `REDIS_KEY_PREFIX` `S3_*`。
**不要打印、提交或修改其中密钥**；不要在代码里写死连接串。Docker 服务只绑 127.0.0.1。

容器化部署留 `docker-compose.yml`：`networks: {shared: {external: true}}`，`env_file: /srv/apps/baofei/.env`，
容器内用 `postgres:5432` / `valkey:6379` / `garage:3900`（即不带 `_HOST` 的变量）。

## 领域硬约束（违反即返工）

1. 金额一律**整数分**存库与计算，仅展示时换算元；未知费用是 `null`，**不能当 0**。
2. 四条业务线（车辆回收 / 注销 / 回收款 / 补贴）各自独立状态；一条变化不得推进另一条。
3. 交车、企业接收、拿到回收证明 **都不等于注销完成**；上传/选择注销证明只到"已提供待核验"。
4. 付款通知 ≠ 车主到账；到账必须由用户显式确认事件推进。
5. 补贴状态与回收净额完全独立；切换"仅报废/换新"只开关补贴待办，不动金额。
6. 凭证带 `caseId + vehicleId`，跨案引用必须拒绝并给出原因。
7. 时间流逝、页面刷新、加载完成都不能生成完成事件。
8. 演示注入事件 `source = demo_controller`，在库、API、UI 上都保留演示身份。
9. 未确认字段（`confirmed = false`）不得产生对用户的承诺文案；`unknown` 与 `false` 分开存。
10. 只填"四川"时市州保持 unknown，不得补成成都；车辆所在地与登记地分开存，不从一方复制。

## 设计系统：废土科技风（Wasteland Tech）

基调：报废场 + 老式工业 HUD。暗色、粗粝、有锈，但**信息优先、可读性不能让步**。
不要赛博朋克霓虹紫蓝，不要玻璃拟态，不要大圆角药丸。

**色板**（定义在 `globals.css` 的 `@theme`，页面只用语义类名，不写死十六进制）

| 变量 | 值 | 用途 |
|---|---|---|
| `--color-void` | `#08090A` | 页面底 |
| `--color-panel` | `#101214` | 卡片/面板 |
| `--color-raise` | `#171A1C` | 输入框、浮层 |
| `--color-line` | `#2A2E31` | 常规描边 |
| `--color-line-strong` | `#3C4247` | 强调描边、分隔 |
| `--color-text` | `#E6E3DA` | 主文本 |
| `--color-dim` | `#9BA1A3` | 次要文本（对 --void ≥ 4.5:1） |
| `--color-rust` | `#FF6A1F` | 唯一主色：主按钮、当前步骤、关键数字 |
| `--color-acid` | `#C9F24D` | 信号色：已核验/在线状态灯 |
| `--color-warn` | `#F2B33D` | 待核实、待确认 |
| `--color-danger` | `#E5484D` | 缺证、冲突、拒绝 |

**字体**：标题 `font-black tracking-tight`（中文用 system 中文栈，见 globals.css base 层）；
标签/编号/金额用 mono + `tabular-nums` + `uppercase tracking-[0.18em]`；正文 16px/1.7。
金额前缀 `¥`，大字号显示净额。

**质感（只用 CSS，不要图片素材）**
- 噪点：全局 `feTurbulence` SVG data-uri 叠层，opacity ≤ 0.04，`pointer-events-none` 固定层。
- 扫描线：`repeating-linear-gradient` 1px/3px，仅用于状态条与页头，低对比。
- 切角：面板用 `clip-path: polygon(...)` 切一个角（左上或右下 12px），或四角 L 形描边；圆角不超过 4px。
- 警示条：45° 斜纹条，只用于"演示模式"分隔与危险操作，高度 ≤ 6px。
- 状态灯：6px 方块 + 文字标签，**永不只靠颜色**表达状态。
- 动效：仅 `prefers-reduced-motion: no-preference` 下做 1.2s 呼吸灯与光标闪烁；不做滚动动画。

**布局**：手机优先（重点 390px，最小 320px），桌面 1280px 两栏/2×2。每页只有一个最高优先级主按钮（锈橙实心）。
点击目标 ≥ 44px，可见 `:focus-visible` 2px acid 描边，错误信息有文字说明。

**常驻元素**：顶部细条 `DEMO · 演示模式 · 演示数据不产生真实法律效力`，以及当前案件号（mono）。不遮挡内容，不闪。

## 文案

中文、直白、动词开头。用"登记证（绿本）""预计实收""还需核对""现在需要做"。
禁止：夸张营销词、保证性承诺（"一定能领补贴""马上注销"）、把演示结果显示成官方查询成功。
`已提供` / `已核验` / `已到账` 三个词严格区分，不得混用。

## 交付习惯

- 每个工作包一次提交，中文 commit message，说明改了什么、怎么验证的。
- 改完必跑 `pnpm lint`、`pnpm test`、`pnpm build`；
- 不许留 `console.log`、假的 TODO 文案、"即将上线"占位。
- 无障碍：语义标签、`aria-live` 用于任务变化、表单 label 关联、错误不只靠颜色。