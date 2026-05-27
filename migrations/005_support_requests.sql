CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS support_requests (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        text        NOT NULL,
  email       text        NOT NULL,
  category    text        NOT NULL,
  message     text        NOT NULL,
  status      text        NOT NULL DEFAULT 'open',
  user_id     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_requests_status_created
  ON support_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_support_requests_email_created
  ON support_requests (email, created_at DESC);

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_support_requests" ON support_requests;
CREATE POLICY "users_select_own_support_requests"
  ON support_requests FOR SELECT
  USING (auth.uid()::text = user_id);
