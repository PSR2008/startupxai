CREATE TABLE IF NOT EXISTS user_roles (
  user_id text PRIMARY KEY,
  role text NOT NULL DEFAULT 'user',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_roles_role_check CHECK (role IN ('user', 'internal', 'admin'))
);

CREATE INDEX IF NOT EXISTS idx_user_roles_role
  ON user_roles (role);

ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_role" ON user_roles;
CREATE POLICY "users_select_own_role"
  ON user_roles FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_insert_roles" ON user_roles;
DROP POLICY IF EXISTS "users_update_roles" ON user_roles;
DROP POLICY IF EXISTS "users_delete_roles" ON user_roles;

