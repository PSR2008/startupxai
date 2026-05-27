CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS founder_profiles (
  user_id          text PRIMARY KEY,
  startup_idea     text NOT NULL,
  product_summary  text NOT NULL,
  target_audience  text NOT NULL,
  industry         text,
  founder_stage    text,
  region           text,
  primary_goal     text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE founder_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_founder_profile" ON founder_profiles;
CREATE POLICY "users_select_own_founder_profile"
  ON founder_profiles FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_insert_own_founder_profile" ON founder_profiles;
CREATE POLICY "users_insert_own_founder_profile"
  ON founder_profiles FOR INSERT
  WITH CHECK (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_update_own_founder_profile" ON founder_profiles;
CREATE POLICY "users_update_own_founder_profile"
  ON founder_profiles FOR UPDATE
  USING (auth.uid()::text = user_id)
  WITH CHECK (auth.uid()::text = user_id);
