<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## 部署（默认动作）

通过验证的改动默认发布到 `publish_web_server`，并做公网健康检查。线上链路：
Nginx `baofei.publicrandom.com` → `127.0.0.1:18012` → systemd `baofei.service` →
Next.js standalone + PGlite（数据在 `/var/lib/baofei/pglite`）。完整步骤见
`docs/deploy-cloud.md`。

不要修改 frp/frps 配置，也不要停用 10802 隧道；不要打印 `.env` 中的密钥。
