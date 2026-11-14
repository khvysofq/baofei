# 第二台部署：qingniao-ecs（www.4d4d4d4d.com）

2026-11-14 完成。与 `publish_web_server`（baofei.publicrandom.com）是两套独立实例，
数据库各自独立，代码来自同一份仓库构建产物。

## 架构

```
浏览器
  → Nginx (www.4d4d4d4d.com / 4d4d4d4d.com, TLS, 阿里云证书)
  → 127.0.0.1:18012
  → systemd: baofei.service
  → node server.js（Next.js standalone）
      ├─ 业务数据：本机 PostgreSQL 13（127.0.0.1:5432，库 baofei）
      └─ 缓存：cache_entries 表（CACHE_DRIVER=db）
```

- SSH：`ssh qingniao-ecs`（root@39.107.59.110，Alibaba Cloud Linux 3）。
- 系统：Alibaba Cloud Linux 3，1.9G 内存，40G 系统盘。
- Node：22.23.5，装在 `/usr/local/lib/node22`，`/usr/local/bin/node` 软链。
- PostgreSQL：13.23（系统仓库），`systemctl status postgresql`。
- 应用：`/srv/apps/baofei`（`.env` 0600，属主 `baofei`）。
- 备份：`/var/lib/baofei/backup/db`，`baofei-db-backup.timer` 每日 02:30（Asia/Shanghai），保留 14 份。
- Nginx 站点：`/etc/nginx/conf.d/4d4d4d4d.com.conf`，改动前备份到 `/etc/nginx/backups/`。
- 原来 `/var/www/4d4d4d4d` 的静态页已不再被引用，保留未删。

## 发布步骤（在开发机执行）

`NEXT_PUBLIC_SITE_URL` 是构建期变量，必须指向目标域名后再构建：

```bash
cd /root/projects/baofei
NEXT_PUBLIC_SITE_URL=https://www.4d4d4d4d.com pnpm exec tsc --noEmit
NEXT_PUBLIC_SITE_URL=https://www.4d4d4d4d.com pnpm build
node scripts/package-standalone.mjs
tar -C .deploy -czf /tmp/baofei-app.tgz baofei

scp /tmp/baofei-app.tgz qingniao-ecs:/tmp/
ssh qingniao-ecs '
  set -e
  systemctl stop baofei
  mv /srv/apps/baofei/.env /tmp/baofei.env.keep
  find /srv/apps/baofei -mindepth 1 -maxdepth 1 -exec rm -rf {} +
  tar -xzf /tmp/baofei-app.tgz -C /srv/apps/baofei --strip-components=1
  mv /tmp/baofei.env.keep /srv/apps/baofei/.env
  chmod 600 /srv/apps/baofei/.env
  chown -R baofei:baofei /srv/apps/baofei
  systemctl start baofei
  sleep 6
  curl -fsS http://127.0.0.1:18012/api/health
'
```

公网验证（本机出网被代理拦截时，可从 `publish_web_server` 执行）：

```bash
for p in / /chengdu /wenda /guanli /robots.txt /sitemap.xml /api/health; do
  curl -s -o /dev/null -w "%{http_code} $p\n" "https://www.4d4d4d4d.com$p"
done
```

## 数据库

- 角色/库：`baofei` / `baofei`，密码在 `/srv/apps/baofei/.env` 的 `DATABASE_URL`。
- 首次初始化时踩过的坑：
  - 系统仓库 initdb 的 `pg_hba.conf` 默认是 `ident`，要改成 `scram-sha-256` 并重设密码；
  - 以 `postgres` 身份恢复 dump 会让表归属 postgres，需改成以 `baofei` 身份恢复，
    或把 `public` schema 及表 owner 一并转给 `baofei`（`REASSIGN OWNED` 会因系统对象失败）。
- PG17 的 `pg_dump` 文本里有一行 `SET transaction_timeout = 0;`，恢复到 PG13 前要过滤掉。
- 手动备份：

```bash
ssh qingniao-ecs 'runuser -u postgres -- pg_dump -Fc -d baofei -f /tmp/baofei.dump'
```

- 恢复（先停应用）：

```bash
ssh qingniao-ecs '
  systemctl stop baofei
  runuser -u postgres -- dropdb --if-exists baofei
  runuser -u postgres -- createdb -O baofei baofei
  PGPASSWORD=$(grep -oP "(?<=baofei:)[^@]+" /srv/apps/baofei/.env) \
    psql -h 127.0.0.1 -U baofei -d baofei -f /tmp/baofei.dump.sql
  runuser -u postgres -- psql -d baofei -qc "ALTER SCHEMA public OWNER TO baofei;"
  systemctl start baofei'
```

## 证书

- `/etc/nginx/ssl/www.4d4d4d4d.com.pem|key`，SAN 覆盖 `www.4d4d4d4d.com` 与 `4d4d4d4d.com`。
- 当前证书有效期至 2027-02-11，到期前需更新（阿里云证书控制台下载后替换并 `nginx -s reload`）。