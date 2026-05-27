-- ================================================================
-- StartupX AI - Phase 2: Usage Tracking Migration
-- Run AFTER migrations/001_billing_infrastructure.sql
--
-- Run in: Supabase Dashboard -> SQL Editor -> Run
-- ================================================================

-- Enable UUID extension (safe to re-run)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ----------------------------------------------------------------
-- usage_logs
-- One row per successful engine analysis.
-- No hard blocking - pure tracking for now.
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usage_logs (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     text        NOT NULL,
  engine_name text        NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Fast monthly-count queries: WHERE user_id = ? AND created_at >= ?
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_month
  ON usage_logs (user_id, created_at DESC);

-- RLS: users can only SELECT their own rows
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own_usage" ON usage_logs;
CREATE POLICY "users_select_own_usage"
  ON usage_logs FOR SELECT
  USING (auth.uid()::text = user_id);

-- ----------------------------------------------------------------
-- Verify both tables exist
-- ----------------------------------------------------------------
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('user_plans', 'payments', 'usage_logs');
-- -> must return 3 rows
-- ================================================================
