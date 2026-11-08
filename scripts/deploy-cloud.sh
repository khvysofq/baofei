#!/usr/bin/env bash
#
# 一键发版：构建产物 → 云端，带数据库备份和健康检查。
#
# 数据库现在是本机 PostgreSQL 17（独立进程），重启应用不再碰数据库文件，
# 所以发版可以放心 stop/start；仍然在发版前 dump 一份，便于回滚业务数据。
#
# 用法：./scripts/deploy-cloud.sh [--skip-build]
set -euo pipefail

HOST="${DEPLOY_HOST:-publish_web_server}"
APP_DIR="/srv/apps/baofei"
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

echo "==> 停服、备份数据库、替换应用"
ssh "$HOST" "set -e
  systemctl stop baofei
  runuser -u postgres -- pg_dump -Fc -d baofei -f /var/lib/baofei/backup/db/predeploy-\$(date +%Y%m%d-%H%M%S).dump
  mv $APP_DIR/.env /tmp/baofei.env.keep
  find $APP_DIR -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf /tmp/baofei-app.tgz -C $APP_DIR --strip-components=1
  mv /tmp/baofei.env.keep $APP_DIR/.env
  chmod 600 $APP_DIR/.env
  chown -R baofei:baofei $APP_DIR
  systemctl start baofei
  sleep 8
  curl -fsS http://127.0.0.1:18012/api/health"

echo
echo "==> 公网验证"
for path in / /chengdu /wenda /api/health; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "https://baofei.publicrandom.com$path")
  echo "  $code  $path"
  [[ "$code" == "200" ]] || { echo "公网验证失败：$path 返回 $code"; exit 1; }
done

echo "==> 发版完成（数据库备份在 $HOST:/var/lib/baofei/backup/db/predeploy-*.dump）"