CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS validation_projects (
  id                   uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              text        NOT NULL,
  startup_name         text        NOT NULL,
  idea_description     text        NOT NULL,
  target_customer      text        NOT NULL,
  target_geography     text        NOT NULL,
  business_model       text        NOT NULL,
  industry             text        NOT NULL,
  development_stage    text        NOT NULL,
  known_competitors    text,
  main_assumptions     text,
  website_url          text,
  overall_score        integer     NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  confidence           text        NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  score_version        text        NOT NULL DEFAULT 'sx-evidence-v1',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_projects_user_created
  ON validation_projects (user_id, created_at DESC);

ALTER TABLE validation_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_validation_projects" ON validation_projects;
CREATE POLICY "users_select_own_validation_projects"
  ON validation_projects FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_insert_own_validation_projects" ON validation_projects;
CREATE POLICY "users_insert_own_validation_projects"
  ON validation_projects FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_update_own_validation_projects" ON validation_projects;
CREATE POLICY "users_update_own_validation_projects"
  ON validation_projects FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_delete_own_validation_projects" ON validation_projects;
CREATE POLICY "users_delete_own_validation_projects"
  ON validation_projects FOR DELETE
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS evidence_items (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  evidence_category     text        NOT NULL,
  title                 text        NOT NULL,
  summary               text        NOT NULL,
  source_name           text        NOT NULL,
  source_url            text,
  source_type           text        NOT NULL,
  published_or_retrieved_at timestamptz,
  accessed_at           timestamptz NOT NULL DEFAULT now(),
  excerpt               text,
  relevance_score       integer     NOT NULL DEFAULT 50 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  reliability_score     integer     NOT NULL DEFAULT 50 CHECK (reliability_score >= 0 AND reliability_score <= 100),
  sentiment             text        NOT NULL DEFAULT 'neutral' CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  evidence_direction    text        NOT NULL CHECK (evidence_direction IN ('supports', 'contradicts', 'neutral')),
  verified_status       text        NOT NULL CHECK (verified_status IN ('verified', 'inferred', 'user_provided', 'unavailable')),
  raw_metadata          jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_evidence_items_project
  ON evidence_items (validation_project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_evidence_items_user_category
  ON evidence_items (user_id, evidence_category);

ALTER TABLE evidence_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_evidence_items" ON evidence_items;
CREATE POLICY "users_select_own_evidence_items"
  ON evidence_items FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS validation_scores (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  category              text        NOT NULL,
  score                 integer     NOT NULL CHECK (score >= 0 AND score <= 100),
  confidence            text        NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
  conclusion            text        NOT NULL,
  supporting_evidence   text[]      NOT NULL DEFAULT '{}',
  opposing_evidence     text[]      NOT NULL DEFAULT '{}',
  assumptions           text[]      NOT NULL DEFAULT '{}',
  uncertainty           text        NOT NULL,
  methodology           text        NOT NULL,
  recommended_next_action text      NOT NULL,
  score_version         text        NOT NULL DEFAULT 'sx-evidence-v1',
  calculated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_scores_project
  ON validation_scores (validation_project_id, category);

ALTER TABLE validation_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_validation_scores" ON validation_scores;
CREATE POLICY "users_select_own_validation_scores"
  ON validation_scores FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS score_components (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  validation_score_id   uuid        REFERENCES validation_scores(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  component_name        text        NOT NULL,
  raw_signal            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  normalized_value      numeric     NOT NULL,
  weight                numeric     NOT NULL,
  contribution          numeric     NOT NULL,
  evidence_kind         text        NOT NULL CHECK (evidence_kind IN ('verified', 'inferred', 'user_provided', 'ai_interpretation', 'unavailable')),
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_components_project
  ON score_components (validation_project_id, component_name);

ALTER TABLE score_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_score_components" ON score_components;
CREATE POLICY "users_select_own_score_components"
  ON score_components FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS score_history (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  previous_score        integer,
  new_score             integer     NOT NULL CHECK (new_score >= 0 AND new_score <= 100),
  change_reason         text        NOT NULL,
  changed_evidence_ids  uuid[]      NOT NULL DEFAULT '{}',
  score_version         text        NOT NULL DEFAULT 'sx-evidence-v1',
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_score_history_project_created
  ON score_history (validation_project_id, created_at DESC);

ALTER TABLE score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_score_history" ON score_history;
CREATE POLICY "users_select_own_score_history"
  ON score_history FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS validation_experiments (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  experiment_type       text        NOT NULL,
  hypothesis            text        NOT NULL,
  assumption_tested     text        NOT NULL,
  target_audience       text        NOT NULL,
  steps                 text[]      NOT NULL DEFAULT '{}',
  estimated_time        text        NOT NULL,
  estimated_cost        text        NOT NULL,
  success_metric        text        NOT NULL,
  minimum_sample_size   integer     NOT NULL DEFAULT 10,
  pass_threshold        text        NOT NULL,
  fail_threshold        text        NOT NULL,
  result                text,
  notes                 text,
  evidence_urls         text[]      NOT NULL DEFAULT '{}',
  status                text        NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'completed', 'archived')),
  start_date            date,
  end_date              date,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_validation_experiments_project_status
  ON validation_experiments (validation_project_id, status);

ALTER TABLE validation_experiments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_validation_experiments" ON validation_experiments;
CREATE POLICY "users_select_own_validation_experiments"
  ON validation_experiments FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_insert_own_validation_experiments" ON validation_experiments;
CREATE POLICY "users_insert_own_validation_experiments"
  ON validation_experiments FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_update_own_validation_experiments" ON validation_experiments;
CREATE POLICY "users_update_own_validation_experiments"
  ON validation_experiments FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS provider_runs (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  provider_name         text        NOT NULL,
  status                text        NOT NULL CHECK (status IN ('configured', 'not_configured', 'success', 'failed', 'skipped')),
  message               text        NOT NULL,
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_provider_runs_project
  ON provider_runs (validation_project_id, started_at DESC);

ALTER TABLE provider_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_provider_runs" ON provider_runs;
CREATE POLICY "users_select_own_provider_runs"
  ON provider_runs FOR SELECT
  USING (auth.uid()::text = user_id);

CREATE TABLE IF NOT EXISTS project_activity (
  id                    uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid        NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id               text        NOT NULL,
  activity_type         text        NOT NULL,
  title                 text        NOT NULL,
  metadata              jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_activity_project_created
  ON project_activity (validation_project_id, created_at DESC);

ALTER TABLE project_activity ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_project_activity" ON project_activity;
CREATE POLICY "users_select_own_project_activity"
  ON project_activity FOR SELECT
  USING (auth.uid()::text = user_id);
