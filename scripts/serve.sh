#!/usr/bin/env bash
# 本机预览用启动脚本。默认 10802 端口，改端口不用改代码：
#   PORT=3000 ./scripts/serve.sh
set -euo pipefail

PORT="${PORT:-10802}"
HOST="${HOST:-0.0.0.0}"

cd "$(dirname "$0")/.."
exec pnpm dev --port "$PORT" --hostname "$HOST"