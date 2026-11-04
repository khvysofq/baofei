-- 004_analytics.sql — 访问统计与 VIN 查询记录
-- 只记录匿名访客 ID（随机 cookie），不存 IP，降低个人信息风险。

CREATE TABLE IF NOT EXISTS visit_events (
  id          bigserial PRIMARY KEY,
  visitor_id  text NOT NULL,
  path        text NOT NULL DEFAULT '/',
  referrer    text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visit_events_created ON visit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_events_visitor ON visit_events(visitor_id, created_at DESC);

-- 每次有效的 VIN 评估都留一条记录（含示例 VIN），便于运营统计。
CREATE TABLE IF NOT EXISTS vin_search_events (
  id               bigserial PRIMARY KEY,
  vin              text NOT NULL,
  is_demo          boolean NOT NULL DEFAULT false,
  status           text NOT NULL CHECK (status IN ('ok', 'not_found', 'error')),
  error_code       text,
  brand_model      text,
  vehicle_type     text,
  provider         text,
  pricing_version  integer,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vin_search_events_created ON vin_search_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vin_search_events_vin ON vin_search_events(vin);
CREATE INDEX IF NOT EXISTS idx_vin_search_events_status ON vin_search_events(status, created_at DESC);