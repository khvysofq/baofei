-- 001_init.sql — baofei demo-sc-v1.1 基础结构
-- 约定：金额列一律为 integer 分；未知费用用 NULL，绝不当 0。

CREATE TABLE IF NOT EXISTS schema_migrations (
  version    text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);

-- 固定演示配置 --------------------------------------------------------------

CREATE TABLE IF NOT EXISTS scenario_templates (
  id           text PRIMARY KEY,
  version      text NOT NULL,
  name         text NOT NULL,
  intake_text  text NOT NULL,
  payload      jsonb NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS document_samples (
  id              text PRIMARY KEY,
  label           text NOT NULL,
  doc_type        text NOT NULL,
  quality         text NOT NULL,
  fields          jsonb NOT NULL,
  original_fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  issues          jsonb NOT NULL DEFAULT '[]'::jsonb,
  asset_key       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_templates (
  provider_id text NOT NULL,
  version     integer NOT NULL,
  name        text NOT NULL,
  gross_fen   integer NOT NULL,
  tow_fen     integer NOT NULL,
  service_fen integer NOT NULL,
  conditions  jsonb NOT NULL DEFAULT '{}'::jsonb,
  demo        boolean NOT NULL DEFAULT true,
  PRIMARY KEY (provider_id, version)
);

CREATE TABLE IF NOT EXISTS city_policy_config (
  id             serial PRIMARY KEY,
  region         text NOT NULL,
  scope          text NOT NULL,
  source_ids     jsonb NOT NULL DEFAULT '[]'::jsonb,
  effective_from date,
  effective_to   date,
  checked_at     date NOT NULL,
  version        text NOT NULL,
  status         text NOT NULL,
  notes          text,
  aliases        jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE (region, scope, version)
);

-- 业务表 --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS cases (
  id                      text PRIMARY KEY,
  case_no                 text NOT NULL UNIQUE,
  scenario_id             text,
  schema_version          text NOT NULL DEFAULT 'demo-sc-v1.1',
  scenario_version        text NOT NULL DEFAULT 'demo-sc-v1.1',
  profile_version         integer NOT NULL DEFAULT 1,
  materials_version       integer NOT NULL DEFAULT 1,
  demo                    boolean NOT NULL DEFAULT true,
  intent                  text NOT NULL DEFAULT 'unknown',
  selected_quote_provider text,
  selected_quote_version  integer,
  handed_over_at          timestamptz,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS case_fields (
  case_id    text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  field      text NOT NULL,
  value      jsonb,
  source     text NOT NULL DEFAULT 'unknown',
  confirmed  boolean NOT NULL DEFAULT false,
  confidence numeric(3,2),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, field)
);

CREATE TABLE IF NOT EXISTS vehicles (
  id              text PRIMARY KEY,
  case_id         text NOT NULL UNIQUE REFERENCES cases(id) ON DELETE CASCADE,
  demo_vehicle_no text NOT NULL,
  plate_masked    text,
  energy_type     text NOT NULL DEFAULT 'unknown',
  use_nature      text NOT NULL DEFAULT '非营运',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS documents (
  id                  text PRIMARY KEY,
  case_id             text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  vehicle_id          text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type                text NOT NULL,
  sample_id           text,
  fields              jsonb,
  original_fields     jsonb,
  issues              jsonb NOT NULL DEFAULT '[]'::jsonb,
  quality             text,
  verification_status text NOT NULL DEFAULT 'unverified',
  confirmed           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, type)
);

CREATE TABLE IF NOT EXISTS tasks (
  id                  text PRIMARY KEY,
  case_id             text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  kind                text NOT NULL,
  active              boolean NOT NULL DEFAULT true,
  status              text NOT NULL DEFAULT 'open',
  reason              text,
  owner               text,
  resolution_versions jsonb,
  resolution_note     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, kind)
);

CREATE TABLE IF NOT EXISTS quotes (
  id            text PRIMARY KEY,
  case_id       text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  provider_id   text NOT NULL,
  provider_name text NOT NULL,
  version       integer NOT NULL,
  currency      text NOT NULL DEFAULT 'CNY',
  gross_fen     integer NOT NULL,
  tow_fen       integer,
  service_fen   integer,
  net_fen       integer,
  conditions    jsonb NOT NULL DEFAULT '{}'::jsonb,
  demo          boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  profile_version integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, provider_id, version)
);

CREATE TABLE IF NOT EXISTS appointments (
  id               text PRIMARY KEY,
  case_id          text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  quote_id         text NOT NULL REFERENCES quotes(id),
  quote_version    integer NOT NULL,
  profile_version  integer NOT NULL,
  materials_version integer NOT NULL,
  slot_id          text NOT NULL,
  location         text NOT NULL,
  handover_person  text,
  drivable         boolean,
  summary          jsonb NOT NULL DEFAULT '{}'::jsonb,
  status           text NOT NULL DEFAULT 'booked',
  appointment_no   text NOT NULL UNIQUE,
  idempotency_key  text NOT NULL,
  cancel_reason    text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS evidence (
  id          text PRIMARY KEY,
  case_id     text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  vehicle_id  text NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  type        text NOT NULL,
  source      text NOT NULL,
  demo        boolean NOT NULL DEFAULT true,
  event_time  timestamptz NOT NULL DEFAULT now(),
  status      text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, vehicle_id, type)
);

CREATE TABLE IF NOT EXISTS subsidy_contexts (
  case_id                  text PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,
  active                   boolean NOT NULL DEFAULT false,
  status                   text NOT NULL DEFAULT 'inactive',
  policy_year              integer NOT NULL DEFAULT 2026,
  purchase_stage           text NOT NULL DEFAULT 'not_bought',
  planned_purchase_region  jsonb,
  invoice_region           jsonb,
  new_registration_province text,
  accepting_city           text,
  window_status            text NOT NULL DEFAULT 'unknown',
  materials                jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

-- 事件 append-only -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS events (
  id         bigserial PRIMARY KEY,
  case_id    text NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  sequence   integer NOT NULL,
  type       text NOT NULL,
  payload    jsonb NOT NULL DEFAULT '{}'::jsonb,
  source     text NOT NULL,
  demo       boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (case_id, sequence)
);

CREATE OR REPLACE FUNCTION baofei_events_append_only()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS events_append_only ON events;
CREATE TRIGGER events_append_only
  BEFORE UPDATE OR DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION baofei_events_append_only();

CREATE INDEX IF NOT EXISTS idx_documents_case ON documents(case_id);
CREATE INDEX IF NOT EXISTS idx_tasks_case ON tasks(case_id, active, status);
CREATE INDEX IF NOT EXISTS idx_quotes_case_active ON quotes(case_id, active);
CREATE INDEX IF NOT EXISTS idx_appointments_case ON appointments(case_id, status);
CREATE INDEX IF NOT EXISTS idx_evidence_case ON evidence(case_id);
CREATE INDEX IF NOT EXISTS idx_events_case_seq ON events(case_id, sequence);