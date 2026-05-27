CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS analyses (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text,
  session_id  text        NOT NULL,
  engine_type text        NOT NULL,
  input_data  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  output_data jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ip_hash     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analyses_user_created
  ON analyses (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_session_created
  ON analyses (session_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_razorpay_payment_id_unique
  ON payments (razorpay_payment_id);

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_analyses" ON analyses;
CREATE POLICY "users_select_own_analyses"
  ON analyses FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_delete_own_analyses" ON analyses;
CREATE POLICY "users_delete_own_analyses"
  ON analyses FOR DELETE
  USING (auth.uid()::text = user_id);
