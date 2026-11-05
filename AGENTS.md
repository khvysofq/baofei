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

## 变更提交（默认动作）

每次改动完成后默认提交并推送到 GitHub（`origin/main`），便于回溯和回滚：

1. `git status` 核对，只 stage 本次相关文件。
2. 写清楚的中文 commit message。
3. `git push origin main`，推送后确认工作区干净。
4. 不 force push、不改写已推送历史、不提交 `.env` 或密钥。

只有用户明确要求「先不提交」时才保留在本地。
