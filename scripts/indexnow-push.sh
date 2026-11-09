#!/usr/bin/env bash
#
# 用 IndexNow 把 sitemap 里的 URL 推给 Bing / Yandex / Seznam 等（免费、无配额）。
# 百度不参与 IndexNow，百度仍走搜索资源平台的 sitemap 提交。
#
# 用法：
#   ./scripts/indexnow-push.sh            # key 从 .indexnow-key 读
#   INDEXNOW_KEY=xxx ./scripts/indexnow-push.sh
#
# key 文件必须能从站点根目录访问：https://<host>/<key>.txt，内容就是 key 本身。
set -euo pipefail

HOST="${SITE_HOST:-baofei.publicrandom.com}"
SITE="https://$HOST"

KEY="${INDEXNOW_KEY:-}"
if [[ -z "$KEY" && -f .indexnow-key ]]; then
  KEY="$(tr -d '\n' < .indexnow-key)"
fi
: "${KEY:?缺少 IndexNow key（.indexnow-key 或 INDEXNOW_KEY）}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
curl -fsS "$SITE/sitemap.xml" \
  | grep -oE '<loc>[^<]+</loc>' \
  | sed -e 's#<loc>##' -e 's#</loc>##' \
  | sort -u > "$tmp"

echo "待推送 URL：$(wc -l < "$tmp") 条"
python3 - "$tmp" "$HOST" "$KEY" > "$tmp.json" <<'PY'
import json, sys
urls = [l.strip() for l in open(sys.argv[1]) if l.strip()]
print(json.dumps({
    "host": sys.argv[2],
    "key": sys.argv[3],
    "keyLocation": f"https://{sys.argv[2]}/{sys.argv[3]}.txt",
    "urlList": urls,
}, ensure_ascii=False))
PY

code=$(curl -s -o /tmp/indexnow.out -w '%{http_code}' \
  -H 'Content-Type: application/json; charset=utf-8' \
  --data-binary "@$tmp.json" \
  https://api.indexnow.org/indexnow)
echo "HTTP $code"
cat /tmp/indexnow.out 2>/dev/null || true
echo
