-- 007_provider_usage.sql — 第三方 VIN 渠道每日调用量（防额度被刷）
-- 每次真正调用渠道前原子预占一次，缓存命中不计数。
CREATE TABLE IF NOT EXISTS provider_usage (
  day         date NOT NULL,
  provider_id text NOT NULL,
  used        integer NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (day, provider_id)
);

CREATE INDEX IF NOT EXISTS idx_provider_usage_day
  ON provider_usage (day);