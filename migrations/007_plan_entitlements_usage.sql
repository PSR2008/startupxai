ALTER TABLE usage_logs
  ADD COLUMN IF NOT EXISTS feature_type text,
  ADD COLUMN IF NOT EXISTS billing_month date;

UPDATE usage_logs
SET feature_type = 'analysis'
WHERE feature_type IS NULL;

UPDATE usage_logs
SET billing_month = date_trunc('month', created_at)::date
WHERE billing_month IS NULL;

ALTER TABLE usage_logs
  ALTER COLUMN feature_type SET DEFAULT 'analysis',
  ALTER COLUMN feature_type SET NOT NULL,
  ALTER COLUMN billing_month SET DEFAULT date_trunc('month', now())::date,
  ALTER COLUMN billing_month SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_logs_user_feature_month
  ON usage_logs (user_id, feature_type, billing_month, engine_name);

CREATE OR REPLACE FUNCTION try_insert_usage_log(
  p_user_id text,
  p_feature_type text,
  p_engine_name text,
  p_limit integer,
  p_engine_specific boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', now())::date;
  v_current integer := 0;
  v_lock_key bigint;
BEGIN
  IF p_user_id IS NULL OR p_user_id = '' OR p_limit < 0 THEN
    RETURN jsonb_build_object('inserted', false, 'currentUsage', 0, 'limit', greatest(p_limit, 0));
  END IF;

  v_lock_key := hashtextextended(
    p_user_id || ':' || p_feature_type || ':' || coalesce(CASE WHEN p_engine_specific THEN p_engine_name ELSE '*' END, '*') || ':' || v_month::text,
    0
  );
  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT count(*)::integer
    INTO v_current
  FROM usage_logs
  WHERE user_id = p_user_id
    AND billing_month = v_month
    AND feature_type = p_feature_type
    AND (
      NOT p_engine_specific
      OR engine_name = p_engine_name
    );

  IF v_current >= p_limit THEN
    RETURN jsonb_build_object('inserted', false, 'currentUsage', v_current, 'limit', p_limit);
  END IF;

  INSERT INTO usage_logs (user_id, engine_name, feature_type, billing_month)
  VALUES (p_user_id, p_engine_name, p_feature_type, v_month);

  RETURN jsonb_build_object('inserted', true, 'currentUsage', v_current + 1, 'limit', p_limit);
END;
$$;
