-- 006_cache_entries.sql — 持久化缓存（无 Redis/Valkey 时使用）
-- 用于 VIN 车型档案等需要跨重启保留的缓存；过期时间由应用写入。
CREATE TABLE IF NOT EXISTS cache_entries (
  key        text PRIMARY KEY,
  value      text NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cache_entries_expires
  ON cache_entries (expires_at);