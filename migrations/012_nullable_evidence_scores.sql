-- Evidence scores can be genuinely unavailable when independent evidence
-- thresholds are not met. Null means "not assessable yet"; zero remains a
-- valid score only when sufficient qualifying evidence strongly contradicts.

ALTER TABLE validation_projects
  ALTER COLUMN overall_score DROP NOT NULL,
  ALTER COLUMN overall_score DROP DEFAULT;

ALTER TABLE validation_scores
  ALTER COLUMN score DROP NOT NULL;

ALTER TABLE score_history
  ALTER COLUMN new_score DROP NOT NULL;

ALTER TABLE score_components
  ALTER COLUMN normalized_value DROP NOT NULL,
  ALTER COLUMN contribution DROP NOT NULL;

COMMENT ON COLUMN validation_projects.overall_score IS
  'Null means insufficient qualifying evidence for an overall Evidence Score. Numeric zero is reserved for assessable dimensions with strongly contradicting evidence.';

COMMENT ON COLUMN validation_scores.score IS
  'Null means the score category did not meet its minimum independent-evidence threshold.';

COMMENT ON COLUMN score_components.normalized_value IS
  'Null means the component describes a missing threshold rather than a numeric scoring signal.';
