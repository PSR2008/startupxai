CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

ALTER TABLE evidence_items
  ADD COLUMN IF NOT EXISTS claim text,
  ADD COLUMN IF NOT EXISTS evidence_type text NOT NULL DEFAULT 'generated_assessment',
  ADD COLUMN IF NOT EXISTS source_quality text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS confidence text NOT NULL DEFAULT 'low',
  ADD COLUMN IF NOT EXISTS evidence_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS created_by text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE evidence_items
  DROP CONSTRAINT IF EXISTS evidence_items_evidence_type_check,
  ADD CONSTRAINT evidence_items_evidence_type_check CHECK (evidence_type IN (
    'verified_public_evidence',
    'founder_provided_evidence',
    'customer_research',
    'experiment_result',
    'assumption',
    'generated_assessment'
  ));

ALTER TABLE evidence_items
  DROP CONSTRAINT IF EXISTS evidence_items_source_quality_check,
  ADD CONSTRAINT evidence_items_source_quality_check CHECK (source_quality IN ('low', 'medium', 'high'));

ALTER TABLE evidence_items
  DROP CONSTRAINT IF EXISTS evidence_items_confidence_check,
  ADD CONSTRAINT evidence_items_confidence_check CHECK (confidence IN ('low', 'medium', 'high'));

ALTER TABLE evidence_items
  DROP CONSTRAINT IF EXISTS evidence_items_evidence_status_check,
  ADD CONSTRAINT evidence_items_evidence_status_check CHECK (evidence_status IN ('active', 'archived'));

UPDATE evidence_items
SET
  created_by = COALESCE(created_by, user_id),
  evidence_type = CASE
    WHEN source_type ILIKE '%customer%' OR source_type ILIKE '%interview%' THEN 'customer_research'
    WHEN source_type ILIKE '%experiment%' THEN 'experiment_result'
    WHEN source_type ILIKE '%assumption%' OR title ILIKE '%assumption%' THEN 'assumption'
    WHEN verified_status = 'verified' THEN 'verified_public_evidence'
    WHEN verified_status = 'user_provided' THEN 'founder_provided_evidence'
    ELSE 'generated_assessment'
  END,
  source_quality = CASE
    WHEN reliability_score >= 75 THEN 'high'
    WHEN reliability_score >= 45 THEN 'medium'
    ELSE 'low'
  END,
  confidence = CASE
    WHEN verified_status = 'verified' AND reliability_score >= 70 THEN 'high'
    WHEN verified_status IN ('verified', 'user_provided') THEN 'medium'
    ELSE 'low'
  END
WHERE created_by IS NULL OR evidence_type = 'generated_assessment';

CREATE INDEX IF NOT EXISTS idx_evidence_items_project_type
  ON evidence_items (validation_project_id, evidence_type, created_at DESC);

DROP POLICY IF EXISTS "users_insert_own_evidence_items" ON evidence_items;
CREATE POLICY "users_insert_own_evidence_items"
  ON evidence_items FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = evidence_items.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "users_update_own_evidence_items" ON evidence_items;
CREATE POLICY "users_update_own_evidence_items"
  ON evidence_items FOR UPDATE
  USING (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = evidence_items.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = evidence_items.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "users_delete_own_evidence_items" ON evidence_items;
CREATE POLICY "users_delete_own_evidence_items"
  ON evidence_items FOR DELETE
  USING (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = evidence_items.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

CREATE TABLE IF NOT EXISTS customer_interviews (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  participant_segment text NOT NULL,
  interview_date date NOT NULL,
  problem_discussed text NOT NULL,
  pain_severity integer NOT NULL DEFAULT 3 CHECK (pain_severity >= 1 AND pain_severity <= 5),
  current_alternative text,
  key_quotes text,
  objections text,
  willingness_to_pay_signal text,
  notes text,
  follow_up_action text,
  converted_evidence_id uuid REFERENCES evidence_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customer_interviews_project_date
  ON customer_interviews (validation_project_id, interview_date DESC);

ALTER TABLE customer_interviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_customer_interviews" ON customer_interviews;
CREATE POLICY "users_select_own_customer_interviews"
  ON customer_interviews FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_insert_own_customer_interviews" ON customer_interviews;
CREATE POLICY "users_insert_own_customer_interviews"
  ON customer_interviews FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = customer_interviews.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "users_update_own_customer_interviews" ON customer_interviews;
CREATE POLICY "users_update_own_customer_interviews"
  ON customer_interviews FOR UPDATE
  USING (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = customer_interviews.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  )
  WITH CHECK (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = customer_interviews.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "users_delete_own_customer_interviews" ON customer_interviews;
CREATE POLICY "users_delete_own_customer_interviews"
  ON customer_interviews FOR DELETE
  USING (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = customer_interviews.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

ALTER TABLE validation_experiments
  ADD COLUMN IF NOT EXISTS target_threshold text,
  ADD COLUMN IF NOT EXISTS measured_result text,
  ADD COLUMN IF NOT EXISTS outcome text,
  ADD COLUMN IF NOT EXISTS learning text,
  ADD COLUMN IF NOT EXISTS next_decision text,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

ALTER TABLE validation_experiments
  DROP CONSTRAINT IF EXISTS validation_experiments_status_check,
  ADD CONSTRAINT validation_experiments_status_check CHECK (status IN ('planned', 'active', 'completed', 'closed', 'archived'));

ALTER TABLE validation_experiments
  DROP CONSTRAINT IF EXISTS validation_experiments_outcome_check,
  ADD CONSTRAINT validation_experiments_outcome_check CHECK (outcome IS NULL OR outcome IN ('passed', 'failed', 'inconclusive'));

UPDATE validation_experiments
SET target_threshold = COALESCE(target_threshold, pass_threshold)
WHERE target_threshold IS NULL;

CREATE TABLE IF NOT EXISTS evidence_claim_links (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  validation_project_id uuid NOT NULL REFERENCES validation_projects(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES evidence_items(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  claim text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (evidence_item_id, claim)
);

CREATE INDEX IF NOT EXISTS idx_evidence_claim_links_project_claim
  ON evidence_claim_links (validation_project_id, claim);

ALTER TABLE evidence_claim_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_evidence_claim_links" ON evidence_claim_links;
CREATE POLICY "users_select_own_evidence_claim_links"
  ON evidence_claim_links FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_insert_own_evidence_claim_links" ON evidence_claim_links;
CREATE POLICY "users_insert_own_evidence_claim_links"
  ON evidence_claim_links FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = evidence_claim_links.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
    AND EXISTS (
      SELECT 1 FROM evidence_items
      WHERE evidence_items.id = evidence_claim_links.evidence_item_id
      AND evidence_items.user_id = auth.uid()::text
      AND evidence_items.validation_project_id = evidence_claim_links.validation_project_id
    )
  );

DROP POLICY IF EXISTS "users_delete_own_evidence_claim_links" ON evidence_claim_links;
CREATE POLICY "users_delete_own_evidence_claim_links"
  ON evidence_claim_links FOR DELETE
  USING (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = evidence_claim_links.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "users_insert_own_project_activity" ON project_activity;
CREATE POLICY "users_insert_own_project_activity"
  ON project_activity FOR INSERT
  WITH CHECK (
    auth.uid()::text = user_id
    AND EXISTS (
      SELECT 1 FROM validation_projects
      WHERE validation_projects.id = project_activity.validation_project_id
      AND validation_projects.user_id = auth.uid()::text
    )
  );
