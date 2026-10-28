# baofei

新站点，基于 **Next.js 16 (App Router) + TypeScript + Tailwind CSS 4**。

## 本地跑起来

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

本机预览固定端口（10802）：

```bash
./scripts/serve.sh          # http://0.0.0.0:10802
PORT=3000 ./scripts/serve.sh # 临时换端口
```

其他命令：

```bash
pnpm build        # 生产构建
pnpm start        # 跑构建产物
pnpm lint         # ESLint
```

## 改内容从哪儿下手

| 想改什么 | 改哪里 |
|---|---|
| 站名、标语、导航、联系方式 | `src/lib/site.ts` |
| 首页文案与板块 | `src/app/page.tsx` |
| 全站字体、颜色变量 | `src/app/globals.css` |
| 页面 `<head>` / SEO | `src/app/layout.tsx` 的 `metadata` |
| 图片等静态资源 | `public/` |

新增页面：在 `src/app/` 下建目录 + `page.tsx`，例如 `src/app/about/page.tsx` → `/about`。

## 部署

- **Vercel**：仓库连上去即可，零配置。
- **自建服务器**：`pnpm build` 后用 `pnpm start`（默认 3000 端口），前置 Caddy/Nginx 反代。
  也可以加 `output: "standalone"`（`next.config.ts`）打成精简镜像。

## 注意

- 上线前把 `src/app/layout.tsx` 里的 `metadataBase` 换成真实域名。
- 骨架里的文案都是占位，别直接当正式内容发布。