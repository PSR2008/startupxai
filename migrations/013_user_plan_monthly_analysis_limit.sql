ALTER TABLE public.user_plans
  ADD COLUMN IF NOT EXISTS monthly_analysis_limit integer;

UPDATE public.user_plans
SET monthly_analysis_limit = CASE plan
  WHEN 'founder' THEN 50
  WHEN 'growth' THEN 150
  WHEN 'scale' THEN 400
  ELSE 5
END
WHERE monthly_analysis_limit IS NULL;
