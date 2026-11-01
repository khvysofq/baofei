-- VIN 查询调用日志：多渠道路由后的命中率、延迟与成本统计。
-- 只增不改；解析结果本身走 Valkey 缓存，不在这里重复存车型明细。
CREATE TABLE IF NOT EXISTS vin_lookups (
  id          bigserial PRIMARY KEY,
  vin         text NOT NULL,
  provider    text NOT NULL,
  status      text NOT NULL CHECK (status IN ('hit', 'cached', 'miss', 'error')),
  error_code  text,
  latency_ms  integer NOT NULL DEFAULT 0,
  cost_fen    numeric(10, 2) NOT NULL DEFAULT 0,
  cached      boolean NOT NULL DEFAULT false,
  report_no   text,
  raw         jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vin_lookups_vin ON vin_lookups(vin);
CREATE INDEX IF NOT EXISTS idx_vin_lookups_created ON vin_lookups(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vin_lookups_provider ON vin_lookups(provider, created_at DESC);