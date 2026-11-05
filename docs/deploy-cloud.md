# 单机部署（云端 + PGlite）

## 架构

```
浏览器
  → Nginx (baofei.publicrandom.com, TLS)
  → 127.0.0.1:18012
  → systemd: baofei.service
  → node server.js（Next.js standalone）
      ├─ 业务数据：PGlite（/var/lib/baofei/pglite）
      ├─ 缓存：PGlite 表 cache_entries（跨重启保留）
      └─ 证件样例：代码生成 SVG，不落对象存储
```

不再需要 Postgres、Valkey、Garage S3，也不再经过 frp 隧道。

> 端口说明：该机器的 frps 占用了 10800–11000 与 22000–22100 区间，因此应用选
> `18012`，避免和 frp 映射冲突。

## 目录

| 路径 | 用途 |
| --- | --- |
| `/srv/apps/baofei` | 应用与 `.env`（0600，属主 `baofei`） |
| `/var/lib/baofei/pglite` | PGlite 数据目录 |
| `/etc/systemd/system/baofei.service` | 服务单元 |
| `/etc/nginx/backups/` | Nginx 配置备份 |
| `/usr/local/lib/node22` | Node 22 运行时 |

## 发布步骤（在开发机执行）

```bash
cd /root/projects/baofei
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit
pnpm build
node scripts/package-standalone.mjs        # 组装 .deploy/baofei
tar -C .deploy -czf /tmp/baofei-app.tgz baofei

scp /tmp/baofei-app.tgz publish_web_server:/tmp/
ssh publish_web_server '
  set -e
  systemctl stop baofei
  mv /srv/apps/baofei/.env /tmp/baofei.env.keep
  # 必须连隐藏目录一起清掉：.next 里可能有旧的路由缓存，否则可能继续返回旧页面
  find /srv/apps/baofei -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf /tmp/baofei-app.tgz -C /srv/apps/baofei --strip-components=1
  mv /tmp/baofei.env.keep /srv/apps/baofei/.env
  chmod 600 /srv/apps/baofei/.env
  chown -R baofei:baofei /srv/apps/baofei
  systemctl start baofei
  sleep 5
  curl -fsS http://127.0.0.1:18012/api/health
'
```

## 数据初始化 / 搬运

新机器首次部署：

```bash
# 开发机：生成一份含现有数据的 PGlite 目录
rm -rf .data/pglite-prod
DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite-prod node scripts/db-migrate.mjs
DB_DRIVER=pglite PGLITE_DATA_DIR=.data/pglite-prod node scripts/db-seed.mjs
node scripts/db-copy.mjs --data-dir .data/pglite-prod

tar -C .data -czf /tmp/baofei-data.tgz pglite-prod
scp /tmp/baofei-data.tgz publish_web_server:/tmp/
ssh publish_web_server '
  set -e
  systemctl stop baofei
  rm -rf /var/lib/baofei/pglite
  mkdir -p /var/lib/baofei/pglite
  tar -xzf /tmp/baofei-data.tgz -C /var/lib/baofei/pglite --strip-components=1
  chown -R baofei:baofei /var/lib/baofei
  systemctl start baofei
'
```

服务启动前会执行 `scripts/db-migrate.mjs`，迁移是幂等的；升级时新增的
`db/migrations/*.sql` 会自动应用。

## 防刷与渠道额度保护

VIN 查询会真实消耗第三方额度，公开接口做了三层保护：

1. **单 IP 限流**（进程内固定窗口，重启清零）
   - `VIN_RATE_LIMIT_PER_MINUTE`（默认 8）
   - `VIN_RATE_LIMIT_PER_HOUR`（默认 40）
   - `VIN_RATE_LIMIT_PER_DAY`（默认 120）
   - 超出返回 `429 RATE_LIMITED` + `Retry-After`，正常用户几乎不会触发。
2. **每日渠道总预算**（数据库 `provider_usage`，跨重启保留）
   - `VIN_DAILY_CALL_LIMIT`（默认 300 次/天，约 ¥13.5）
   - 只有缓存未命中、真正要打渠道时才原子预占一次；缓存命中不占预算。
   - 超限后所有未缓存 VIN 返回 `503 QUOTA_EXCEEDED`，已缓存车辆仍可正常查询。
3. **紧急开关**
   - `VIN_KILL_SWITCH=1` 后停止调用渠道，缓存仍可用；改回 `0` 并重启恢复。

后台 `/guanli/tongji` 新增「今日渠道调用」卡片，可看到已用 / 上限 / 剩余。

## VIN 缓存

云端没有 Redis，使用 `CACHE_DRIVER=db`：VIN 成功结果写入 PGlite 的
`cache_entries` 表，`VIN_CACHE_TTL_SECONDS=2592000`（30 天），命中后顺延 TTL。
服务重启或重新发版都不会丢缓存；同一 VIN 只有第一次会打第三方渠道并计费。
查询失败（渠道未返回车型）只缓存 10 分钟，避免把临时故障锁死 30 天。

```bash
# 检查缓存行与剩余天数（需要先 systemctl stop baofei）
SELECT key, round(extract(epoch from (expires_at - now()))/86400.0, 2) AS days
FROM cache_entries ORDER BY key;
```

## 备份与恢复

```bash
# 备份（PGlite 必须停服后拷贝，避免 WAL 不一致）
ssh publish_web_server '
  systemctl stop baofei
  tar -C /var/lib/baofei -czf /root/baofei-pglite-$(date +%F-%H%M).tgz pglite
  systemctl start baofei
'

# 恢复
ssh publish_web_server '
  systemctl stop baofei
  rm -rf /var/lib/baofei/pglite
  mkdir -p /var/lib/baofei
  tar -xzf /root/baofei-pglite-YYYY-MM-DD-HHMM.tgz -C /var/lib/baofei
  chown -R baofei:baofei /var/lib/baofei
  systemctl start baofei
'
```

## 切回 Postgres（可选）

`.env` 里设置 `DB_DRIVER=pg` 与 `DATABASE_URL`，重启即可。此时 Redis / S3 仍是可选的：
不配 `REDIS_URL` 用内存缓存，不配 `S3_ENDPOINT` 本地生成样例。

## 验收

```bash
curl -fsS https://baofei.publicrandom.com/api/health
# {"data":{"status":"ok",...,"dbDriver":"pglite","storageDriver":"local","cacheDriver":"db"}}

systemctl status baofei
journalctl -u baofei -n 50 --no-pager
```

## 常见问题

- **EADDRINUSE**：换一个 frps 区间外的端口，并同步改 `PORT` 与 Nginx `proxy_pass`。
- **health 里 database=false**：看 `journalctl -u baofei`；多数是数据目录权限或
  `PGLITE_DATA_DIR` 路径不对。
- **PGlite 是单连接**：应用内所有查询/事务已串行化。不要用多个进程同时打开同一数据目录。