BEGIN;

CREATE VIEW privacy.current_consents
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (cr.user_id, cr.purpose_code)
  cr.id,
  cr.user_id,
  cr.purpose_code,
  cr.policy_version_id,
  cr.decision,
  cr.actor_relationship,
  cr.expires_at,
  cr.recorded_at
FROM privacy.consent_records cr
ORDER BY cr.user_id, cr.purpose_code, cr.recorded_at DESC, cr.id DESC;

CREATE VIEW profile.current_preferences
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (lp.learner_user_id, lp.dimension_code)
  lp.id,
  lp.learner_user_id,
  lp.dimension_code,
  lp.affinity,
  lp.importance,
  lp.confidence,
  lp.source_type,
  lp.source_reference,
  lp.observed_at
FROM profile.learner_preferences lp
ORDER BY lp.learner_user_id, lp.dimension_code, lp.observed_at DESC, lp.id DESC;

CREATE VIEW market.current_job_posting_versions
WITH (security_invoker = true)
AS
SELECT
  jp.id AS job_posting_id,
  jp.data_source_id,
  jp.external_id,
  jp.employer_organization_id,
  jp.canonical_url,
  jp.status,
  jp.first_seen_at,
  jp.last_seen_at,
  jpv.id AS job_posting_version_id,
  jpv.version_number,
  jpv.title_raw,
  jpv.description_raw,
  jpv.location_id,
  jpv.work_mode,
  jpv.employment_type,
  jpv.experience_min_years,
  jpv.experience_max_years,
  jpv.salary_min,
  jpv.salary_max,
  jpv.salary_currency,
  jpv.salary_period,
  jpv.salary_disclosure,
  jpv.posted_at,
  jpv.expires_at,
  jpv.captured_at
FROM market.job_postings jp
JOIN market.job_posting_versions jpv
  ON jpv.job_posting_id = jp.id
 AND jpv.is_current
WHERE jp.duplicate_of_posting_id IS NULL
  AND jp.status NOT IN ('duplicate', 'quarantined', 'removed');

CREATE VIEW learning.current_opportunity_versions
WITH (security_invoker = true)
AS
SELECT
  o.id AS opportunity_id,
  o.opportunity_type,
  o.provider_organization_id,
  o.data_source_id,
  o.external_id,
  o.status,
  ov.id AS opportunity_version_id,
  ov.version_number,
  ov.title,
  ov.description,
  ov.delivery_mode,
  ov.location_id,
  ov.source_url,
  ov.duration_hours,
  ov.duration_weeks,
  ov.cost_min,
  ov.cost_max,
  ov.cost_currency,
  ov.enrollment_opens_on,
  ov.enrollment_closes_on,
  ov.starts_on,
  ov.ends_on,
  ov.eligibility_text,
  ov.is_sponsored,
  ov.sponsor_disclosure,
  ov.verification_status,
  ov.reviewed_at,
  ov.expires_at
FROM learning.opportunities o
JOIN learning.opportunity_versions ov
  ON ov.opportunity_id = o.id
 AND ov.is_current
WHERE o.status = 'active';

CREATE VIEW recommendation.latest_completed_runs
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (rr.learner_user_id)
  rr.id,
  rr.learner_user_id,
  rr.profile_snapshot_id,
  rr.model_release_id,
  rr.taxonomy_release_id,
  rr.market_data_as_of,
  rr.completed_at
FROM recommendation.runs rr
WHERE rr.status IN ('completed', 'completed_with_warnings')
ORDER BY rr.learner_user_id, rr.completed_at DESC, rr.id DESC;

CREATE VIEW roadmap.current_milestone_progress
WITH (security_invoker = true)
AS
SELECT DISTINCT ON (pe.milestone_id)
  pe.roadmap_id,
  pe.milestone_id,
  pe.status,
  pe.completion_percent,
  pe.note,
  pe.blocker_text,
  pe.actor_user_id,
  pe.occurred_at
FROM roadmap.progress_events pe
ORDER BY pe.milestone_id, pe.occurred_at DESC, pe.id DESC;

GRANT SELECT ON privacy.current_consents, profile.current_preferences,
  market.current_job_posting_versions, learning.current_opportunity_versions,
  recommendation.latest_completed_runs, roadmap.current_milestone_progress
TO meshmind_app;

GRANT SELECT ON market.current_job_posting_versions, learning.current_opportunity_versions
TO meshmind_market_worker, meshmind_readonly;

GRANT SELECT ON profile.current_preferences, market.current_job_posting_versions,
  learning.current_opportunity_versions
TO meshmind_recommendation_worker;

CREATE OR REPLACE FUNCTION governance.validate_business_invariants()
RETURNS TABLE (
  rule_code text,
  severity text,
  violation_count bigint,
  detail text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, governance, recommendation, profile, market, learning,
  taxonomy, roadmap, privacy, counseling
AS $function$
  SELECT
    'DBR_REC_001'::text,
    'error'::text,
    count(*)::bigint,
    'Recommendation run completed with fewer than three ready career options.'::text
  FROM recommendation.runs rr
  WHERE rr.status IN ('completed', 'completed_with_warnings')
    AND (
      SELECT count(*)
      FROM recommendation.career_options co
      WHERE co.recommendation_run_id = rr.id AND co.state = 'ready'
    ) < 3

  UNION ALL

  SELECT
    'DBR_REC_002',
    'error',
    count(*)::bigint,
    'Ready career option does not contain all six required display dimensions.'
  FROM recommendation.career_options co
  WHERE co.state = 'ready'
    AND (
      SELECT count(DISTINCT od.dimension_code)
      FROM recommendation.option_dimensions od
      WHERE od.career_option_id = co.id
    ) <> 6

  UNION ALL

  SELECT
    'DBR_REC_003',
    'error',
    count(*)::bigint,
    'Ready career option is missing a required explanation type.'
  FROM recommendation.career_options co
  WHERE co.state = 'ready'
    AND EXISTS (
      SELECT 1
      FROM unnest(ARRAY['why_fit', 'market_evidence', 'tradeoff', 'uncertainty', 'exploration_step']) AS required(reason_type)
      WHERE NOT EXISTS (
        SELECT 1
        FROM recommendation.option_reasons ore
        WHERE ore.career_option_id = co.id
          AND ore.reason_type = required.reason_type
      )
    )

  UNION ALL

  SELECT
    'DBR_REC_004',
    'error',
    count(*)::bigint,
    'Ready career option has no traceable published labor-market signal.'
  FROM recommendation.career_options co
  WHERE co.state = 'ready'
    AND NOT EXISTS (
      SELECT 1
      FROM recommendation.option_market_links oml
      JOIN market.labor_market_signals lms ON lms.id = oml.labor_market_signal_id
      WHERE oml.career_option_id = co.id
        AND lms.status = 'published'
    )

  UNION ALL

  SELECT
    'DBR_REC_005',
    'warning',
    count(*)::bigint,
    'Non-exploration option has fewer than two distinct personal evidence types.'
  FROM recommendation.career_options co
  WHERE co.state = 'ready'
    AND co.option_category <> 'exploration'
    AND (
      SELECT count(DISTINCT ei.evidence_type)
      FROM recommendation.option_evidence_links oel
      JOIN profile.evidence_items ei ON ei.id = oel.evidence_item_id
      WHERE oel.career_option_id = co.id
        AND ei.deleted_at IS NULL
    ) < 2

  UNION ALL

  SELECT
    'DBR_REC_006',
    'error',
    count(*)::bigint,
    'Recommendation run and profile snapshot belong to different learners.'
  FROM recommendation.runs rr
  JOIN profile.profile_snapshots ps ON ps.id = rr.profile_snapshot_id
  WHERE ps.learner_user_id <> rr.learner_user_id

  UNION ALL

  SELECT
    'DBR_REC_007',
    'error',
    count(*)::bigint,
    'Career option links evidence owned by a different learner.'
  FROM recommendation.option_evidence_links oel
  JOIN recommendation.career_options co ON co.id = oel.career_option_id
  JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
  LEFT JOIN profile.evidence_items ei ON ei.id = oel.evidence_item_id
  LEFT JOIN profile.skill_observations so ON so.id = oel.skill_observation_id
  WHERE (ei.id IS NOT NULL AND ei.learner_user_id <> rr.learner_user_id)
     OR (so.id IS NOT NULL AND so.learner_user_id <> rr.learner_user_id)

  UNION ALL

  SELECT
    'DBR_REC_008',
    'error',
    count(*)::bigint,
    'Career-option feedback was recorded by a user other than the recommendation owner.'
  FROM recommendation.option_feedback ofe
  JOIN recommendation.career_options co ON co.id = ofe.career_option_id
  JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
  WHERE ofe.user_id <> rr.learner_user_id

  UNION ALL

  SELECT
    'DBR_REC_009',
    'error',
    count(*)::bigint,
    'Option evidence/market link points to a reason owned by another career option.'
  FROM (
    SELECT oel.career_option_id, oel.option_reason_id
    FROM recommendation.option_evidence_links oel
    WHERE oel.option_reason_id IS NOT NULL
    UNION ALL
    SELECT oml.career_option_id, oml.option_reason_id
    FROM recommendation.option_market_links oml
    WHERE oml.option_reason_id IS NOT NULL
  ) linked_reason
  JOIN recommendation.option_reasons ore ON ore.id = linked_reason.option_reason_id
  WHERE ore.career_option_id <> linked_reason.career_option_id

  UNION ALL

  SELECT
    'DBR_REC_010',
    'error',
    count(*)::bigint,
    'Recommendation run taxonomy differs from the non-null taxonomy declared by its model release.'
  FROM recommendation.runs rr
  JOIN governance.model_releases mr ON mr.id = rr.model_release_id
  WHERE mr.taxonomy_release_id IS NOT NULL
    AND mr.taxonomy_release_id <> rr.taxonomy_release_id

  UNION ALL

  SELECT
    'DBR_MKT_001',
    'error',
    count(*)::bigint,
    'Published shortage classification lacks labor-supply sample evidence.'
  FROM market.labor_market_signals lms
  WHERE lms.status = 'published'
    AND lms.shortage_classification IN ('low', 'moderate', 'high')
    AND lms.supply_sample_size = 0

  UNION ALL

  SELECT
    'DBR_MKT_002',
    'warning',
    count(*)::bigint,
    'Published signal has no source contribution row.'
  FROM market.labor_market_signals lms
  WHERE lms.status = 'published'
    AND NOT EXISTS (
      SELECT 1
      FROM market.signal_source_stats sss
      WHERE sss.labor_market_signal_id = lms.id
    )

  UNION ALL

  SELECT
    'DBR_MKT_003',
    'error',
    count(*)::bigint,
    'Source contribution count exceeds parent market-signal count.'
  FROM market.labor_market_signals lms
  WHERE (
    SELECT coalesce(sum(sss.accepted_posting_count), 0)
    FROM market.signal_source_stats sss
    WHERE sss.labor_market_signal_id = lms.id
  ) > lms.posting_count

  UNION ALL

  SELECT
    'DBR_RDM_001',
    'error',
    count(*)::bigint,
    'Roadmap current_version_id points to a version of another roadmap.'
  FROM roadmap.roadmaps r
  JOIN roadmap.roadmap_versions rv ON rv.id = r.current_version_id
  WHERE rv.roadmap_id <> r.id

  UNION ALL

  SELECT
    'DBR_RDM_002',
    'error',
    count(*)::bigint,
    'Milestone dependency crosses roadmap versions.'
  FROM roadmap.milestone_dependencies md
  JOIN roadmap.milestones m ON m.id = md.milestone_id
  JOIN roadmap.milestones dependency ON dependency.id = md.depends_on_milestone_id
  WHERE m.roadmap_version_id <> dependency.roadmap_version_id

  UNION ALL

  SELECT
    'DBR_RDM_003',
    'warning',
    count(*)::bigint,
    'Published milestone is linked to neither a skill nor an evidence requirement.'
  FROM roadmap.milestones m
  JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
  WHERE rv.status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM roadmap.milestone_skills ms WHERE ms.milestone_id = m.id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM roadmap.milestone_evidence_requirements mer
      WHERE mer.milestone_id = m.id
    )

  UNION ALL

  SELECT
    'DBR_RDM_004',
    'error',
    count(*)::bigint,
    'Progress event references a milestone outside its roadmap.'
  FROM roadmap.progress_events pe
  JOIN roadmap.milestones m ON m.id = pe.milestone_id
  JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
  WHERE rv.roadmap_id <> pe.roadmap_id

  UNION ALL

  SELECT
    'DBR_RDM_005',
    'error',
    count(*)::bigint,
    'Milestone evidence is owned by a learner other than the roadmap owner.'
  FROM roadmap.milestone_evidence_links mel
  JOIN roadmap.milestones m ON m.id = mel.milestone_id
  JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
  JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
  JOIN profile.evidence_items ei ON ei.id = mel.evidence_item_id
  WHERE ei.learner_user_id <> r.learner_user_id

  UNION ALL

  SELECT
    'DBR_RDM_006',
    'error',
    count(*)::bigint,
    'A milestone supersedes a milestone belonging to another roadmap.'
  FROM roadmap.milestones m
  JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
  JOIN roadmap.milestones prior ON prior.id = m.supersedes_milestone_id
  JOIN roadmap.roadmap_versions prior_rv ON prior_rv.id = prior.roadmap_version_id
  WHERE rv.roadmap_id <> prior_rv.roadmap_id

  UNION ALL

  SELECT
    'DBR_PRV_001',
    'error',
    count(*)::bigint,
    'Share grant consent belongs to a different data owner or is not a grant decision.'
  FROM privacy.share_grants sg
  JOIN privacy.consent_records cr ON cr.id = sg.consent_record_id
  WHERE cr.user_id <> sg.owner_user_id
     OR cr.decision <> 'granted'

  UNION ALL

  SELECT
    'DBR_PRV_002',
    'error',
    count(*)::bigint,
    'Counseling relationship does not match the associated share grant participants or type.'
  FROM counseling.relationships cr
  JOIN privacy.share_grants sg ON sg.id = cr.share_grant_id
  WHERE sg.owner_user_id <> cr.learner_user_id
     OR sg.recipient_user_id <> cr.counselor_user_id
     OR sg.relationship_type <> 'counselor'

  UNION ALL

  SELECT
    'DBR_PRV_003',
    'error',
    count(*)::bigint,
    'Active share grant is based on expired consent or a non-sharing consent purpose.'
  FROM privacy.share_grants sg
  JOIN privacy.consent_records cr ON cr.id = sg.consent_record_id
  WHERE sg.status = 'active'
    AND (
      cr.purpose_code NOT IN ('sharing.counselor', 'sharing.guardian')
      OR (cr.expires_at IS NOT NULL AND cr.expires_at <= now())
    )

  UNION ALL

  SELECT
    'DBR_PRV_004',
    'error',
    count(*)::bigint,
    'Share-grant relationship type does not match its consent purpose.'
  FROM privacy.share_grants sg
  JOIN privacy.consent_records cr ON cr.id = sg.consent_record_id
  WHERE (sg.relationship_type = 'counselor' AND cr.purpose_code <> 'sharing.counselor')
     OR (sg.relationship_type = 'guardian' AND cr.purpose_code <> 'sharing.guardian')
$function$;

REVOKE ALL ON FUNCTION governance.validate_business_invariants() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION governance.validate_business_invariants()
TO meshmind_auditor, meshmind_market_worker, meshmind_recommendation_worker;

DO $verification$
DECLARE
  required_table text;
  missing_tables text[] := ARRAY[]::text[];
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'iam.users',
    'iam.user_emails',
    'privacy.consent_records',
    'privacy.share_grants',
    'taxonomy.skills',
    'taxonomy.occupations',
    'profile.learner_profiles',
    'profile.evidence_items',
    'profile.skill_observations',
    'market.job_postings',
    'market.job_posting_versions',
    'market.labor_market_signals',
    'learning.opportunities',
    'learning.opportunity_versions',
    'governance.model_releases',
    'recommendation.runs',
    'recommendation.career_options',
    'roadmap.roadmaps',
    'roadmap.roadmap_versions',
    'roadmap.milestones',
    'counseling.relationships',
    'governance.audit_events'
  ]::text[]
  LOOP
    IF to_regclass(required_table) IS NULL THEN
      missing_tables := array_append(missing_tables, required_table);
    END IF;
  END LOOP;

  IF cardinality(missing_tables) > 0 THEN
    RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing_tables, ', ');
  END IF;
END;
$verification$;

COMMENT ON FUNCTION governance.validate_business_invariants() IS
  'Returns cross-table business-rule violations that cannot be expressed as ordinary FK/CHECK constraints.';

COMMIT;

-- Operational verification command:
-- SELECT *
-- FROM governance.validate_business_invariants()
-- WHERE violation_count > 0
-- ORDER BY severity, rule_code;
