CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS generated_reports (
  id                 uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id            text        NOT NULL,
  source_analysis_id uuid        REFERENCES analyses(id) ON DELETE CASCADE,
  report_type        text        NOT NULL CHECK (report_type IN ('detailed', 'investor_memo', 'slide_summary')),
  title              text        NOT NULL,
  content            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_generated_reports_user_created
  ON generated_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_generated_reports_source_type
  ON generated_reports (source_analysis_id, report_type, created_at DESC);

ALTER TABLE generated_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_generated_reports" ON generated_reports;
CREATE POLICY "users_select_own_generated_reports"
  ON generated_reports FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_delete_own_generated_reports" ON generated_reports;
CREATE POLICY "users_delete_own_generated_reports"
  ON generated_reports FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS shared_report_links (
  id             uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_kind    text        NOT NULL CHECK (report_kind IN ('analysis', 'generated_report')),
  report_id      uuid        NOT NULL,
  owner_user_id  text        NOT NULL,
  token_hash     text        NOT NULL UNIQUE,
  is_active      boolean     NOT NULL DEFAULT true,
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  revoked_at     timestamptz,
  last_viewed_at timestamptz,
  view_count     integer     NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_shared_report_links_owner_created
  ON shared_report_links (owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_report_links_report
  ON shared_report_links (report_kind, report_id);

ALTER TABLE shared_report_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_shared_report_links" ON shared_report_links;
CREATE POLICY "users_select_own_shared_report_links"
  ON shared_report_links FOR SELECT
  USING (auth.uid()::text = owner_user_id);

CREATE TABLE IF NOT EXISTS product_events (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text,
  event_name  text        NOT NULL,
  properties  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_events_name_created
  ON product_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_events_user_created
  ON product_events (user_id, created_at DESC);

ALTER TABLE product_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_product_events" ON product_events;
CREATE POLICY "users_select_own_product_events"
  ON product_events FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS product_feedback_registry (
  id               uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  feature_name     text        NOT NULL,
  category         text        NOT NULL,
  similar_requests integer     NOT NULL DEFAULT 1,
  request_source   text        NOT NULL,
  status           text        NOT NULL CHECK (status IN ('New', 'Researching', 'Planned', 'In progress', 'Released', 'Rejected', 'Validation')),
  priority         text        NOT NULL CHECK (priority IN ('Low', 'Medium', 'High')),
  notes            text,
  date_received    date        NOT NULL DEFAULT current_date,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_product_feedback_registry_feature_unique
  ON product_feedback_registry (feature_name);

ALTER TABLE product_feedback_registry ENABLE ROW LEVEL SECURITY;

INSERT INTO product_feedback_registry (
  feature_name,
  category,
  similar_requests,
  request_source,
  status,
  priority,
  notes
)
VALUES (
  'Investor Objection Simulator',
  'Investor Objection Simulator',
  1,
  'Product Hunt',
  'Validation',
  'Medium',
  'One direct Product Hunt request. Potential scope: tough investor questions, follow-ups, assumption stress testing, and answer coaching. Not advertised as available.'
)
ON CONFLICT (feature_name) DO UPDATE
SET
  similar_requests = GREATEST(product_feedback_registry.similar_requests, EXCLUDED.similar_requests),
  status = EXCLUDED.status,
  priority = EXCLUDED.priority,
  notes = EXCLUDED.notes,
  updated_at = now();
