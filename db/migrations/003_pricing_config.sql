-- 003_pricing_config.sql — 可后台编辑的收购价定价配置
-- payload 为完整 PricingConfig（JSON），金额一律整数分。
-- 只增不改；「同时只有一行 active」由应用层事务保证。

CREATE TABLE IF NOT EXISTS pricing_configs (
  version    integer PRIMARY KEY,
  payload    jsonb NOT NULL,
  active     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricing_configs_active
  ON pricing_configs (active, version DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_configs_created
  ON pricing_configs (created_at DESC);