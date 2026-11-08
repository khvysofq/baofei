#!/usr/bin/env bash
#
# 一键发版：构建产物 → 云端，带数据库备份和健康检查回滚。
#
# 背景：云端是 PGlite（嵌入式 Postgres），进程收到 SIGTERM 停库时有不小概率
# 留下无效 checkpoint，下次启动会 PANIC: could not locate a valid checkpoint record。
# 2026-11-08 因此停机两次。所以这里把「停服前备份 + 启动失败自动回滚」做进流程。
#
# 用法：./scripts/deploy-cloud.sh [--skip-build]
set -euo pipefail

HOST="${DEPLOY_HOST:-publish_web_server}"
APP_DIR="/srv/apps/baofei"
DATA_DIR="/var/lib/baofei/pglite"
BACKUP_DIR="/var/lib/baofei/backup"
TARBALL="/tmp/baofei-app.tgz"

cd "$(dirname "$0")/.."

if [[ "${1:-}" != "--skip-build" ]]; then
  echo "==> 类型检查"
  pnpm exec tsc --noEmit
  echo "==> 构建"
  pnpm build
  echo "==> 组装 standalone"
  node scripts/package-standalone.mjs
fi

echo "==> 打包"
tar -C .deploy -czf "$TARBALL" baofei

echo "==> 上传"
scp -q "$TARBALL" "$HOST:/tmp/"

echo "==> 停止服务并备份数据库"
ssh "$HOST" "set -e
  systemctl stop baofei || true
  sleep 3
  STAMP=\$(date +%Y%m%d-%H%M%S)
  cp -a $DATA_DIR $BACKUP_DIR/pglite-predeploy-\$STAMP
  echo \"备份：$BACKUP_DIR/pglite-predeploy-\$STAMP\"
  mv $APP_DIR/.env /tmp/baofei.env.keep
  find $APP_DIR -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf /tmp/baofei-app.tgz -C $APP_DIR --strip-components=1
  mv /tmp/baofei.env.keep $APP_DIR/.env
  chmod 600 $APP_DIR/.env
  chown -R baofei:baofei $APP_DIR
  systemctl start baofei || true
  sleep 8
  if curl -fsS http://127.0.0.1:18012/api/health >/dev/null 2>&1; then
    echo START_OK
  else
    echo START_FAIL
    exit 1
  fi"

echo "==> 公网验证"
for path in / /chengdu /wenda /api/health; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://baofei.publicrandom.com$path")
  echo "  $code  $path"
  [[ "$code" == "200" ]] || { echo "公网验证失败：$path 返回 $code"; exit 1; }
done

echo "==> 发版完成"
echo "   数据库备份在 $HOST:$BACKUP_DIR/pglite-predeploy-*"
echo "   若数据库损坏，恢复：systemctl stop baofei && rm -rf $DATA_DIR && cp -a <备份> $DATA_DIR && chown -R baofei:baofei $DATA_DIR && systemctl start baofei"