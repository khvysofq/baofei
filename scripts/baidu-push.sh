#!/usr/bin/env bash
#
# 把 sitemap 里的全部 URL 推送给百度普通收录接口。
#
# 用法：
#   BAIDU_TOKEN=xxxx ./scripts/baidu-push.sh
#
# token 不要写进仓库，也不要提交 urls.txt。
# 接口返回值：
#   {"success":N,"remain":M}        推送成功 N 条，今日还剩 M 条
#   {"error":400,"message":"over quota"}  今日配额已用完（次日 0 点北京时间重置）
#   {"error":401,"message":"token is not valid"}  token 不对
set -euo pipefail

SITE="${BAIDU_SITE:-https://baofei.publicrandom.com}"
: "${BAIDU_TOKEN:?需要设置 BAIDU_TOKEN}"

tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT

curl -fsS "$SITE/sitemap.xml" \
  | grep -oE '<loc>[^<]+</loc>' \
  | sed -e 's#<loc>##' -e 's#</loc>##' \
  | sort -u > "$tmp"

echo "待推送 URL：$(wc -l < "$tmp") 条"
curl -s -H 'Content-Type:text/plain' --data-binary "@$tmp" \
  "http://data.zz.baidu.com/urls?site=$SITE&token=$BAIDU_TOKEN"
echo
