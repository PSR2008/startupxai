CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS user_plans (
  user_id       text PRIMARY KEY,
  plan          text NOT NULL DEFAULT 'free',
  billing_cycle text,
  active        boolean NOT NULL DEFAULT false,
  expires_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             text,
  plan                text NOT NULL,
  billing_cycle       text NOT NULL,
  razorpay_order_id   text NOT NULL,
  razorpay_payment_id text NOT NULL,
  amount              integer,
  currency            text NOT NULL DEFAULT 'INR',
  status              text NOT NULL DEFAULT 'paid',
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON payments (user_id, created_at DESC);

ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_plan" ON user_plans;
CREATE POLICY "users_select_own_plan"
  ON user_plans FOR SELECT
  USING (auth.uid()::text = user_id);

DROP POLICY IF EXISTS "users_select_own_payments" ON payments;
CREATE POLICY "users_select_own_payments"
  ON payments FOR SELECT
  USING (auth.uid()::text = user_id);
