BEGIN;

CREATE TABLE governance.model_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_type text NOT NULL,
  provider_name text NOT NULL,
  model_name text NOT NULL,
  model_version text NOT NULL,
  prompt_version text,
  taxonomy_release_id uuid REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  artifact_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  approved_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  activated_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT model_releases_type_valid CHECK (
    model_type IN ('occupation_mapping', 'skill_extraction', 'recommendation', 'profile_inference', 'explanation', 'fairness_classifier')
  ),
  CONSTRAINT model_releases_configuration_object CHECK (jsonb_typeof(configuration) = 'object'),
  CONSTRAINT model_releases_hash_format CHECK (artifact_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT model_releases_status_valid CHECK (
    status IN ('draft', 'validation', 'approved', 'active', 'paused', 'retired', 'rejected')
  ),
  CONSTRAINT model_releases_approval_consistent CHECK (
    (status IN ('approved', 'active', 'paused', 'retired') AND approved_at IS NOT NULL)
    OR status IN ('draft', 'validation', 'rejected')
  ),
  CONSTRAINT model_releases_activation_consistent CHECK (
    (status IN ('active', 'paused', 'retired') AND activated_at IS NOT NULL)
    OR status IN ('draft', 'validation', 'approved', 'rejected')
  ),
  CONSTRAINT model_releases_retirement_consistent CHECK (
    retired_at IS NULL OR (activated_at IS NOT NULL AND retired_at >= activated_at)
  )
);

CREATE UNIQUE INDEX model_releases_identity_idx
  ON governance.model_releases(
    model_type,
    provider_name,
    model_name,
    model_version,
    coalesce(prompt_version, '')
  );

CREATE INDEX model_releases_active_idx
  ON governance.model_releases(model_type, activated_at DESC)
  WHERE status = 'active';

CREATE TABLE market.ingestion_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES catalog.data_sources(id) ON DELETE RESTRICT,
  run_type text NOT NULL DEFAULT 'incremental',
  status text NOT NULL DEFAULT 'queued',
  source_window_start timestamptz,
  source_window_end timestamptz,
  configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  records_received integer NOT NULL DEFAULT 0,
  records_accepted integer NOT NULL DEFAULT 0,
  records_rejected integer NOT NULL DEFAULT 0,
  records_quarantined integer NOT NULL DEFAULT 0,
  started_at timestamptz,
  completed_at timestamptz,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ingestion_runs_type_valid CHECK (run_type IN ('full', 'incremental', 'reprocess')),
  CONSTRAINT ingestion_runs_status_valid CHECK (
    status IN ('queued', 'running', 'completed', 'completed_with_errors', 'failed', 'cancelled')
  ),
  CONSTRAINT ingestion_runs_window_valid CHECK (
    source_window_end IS NULL OR source_window_start IS NULL OR source_window_end >= source_window_start
  ),
  CONSTRAINT ingestion_runs_configuration_object CHECK (jsonb_typeof(configuration) = 'object'),
  CONSTRAINT ingestion_runs_counts_nonnegative CHECK (
    records_received >= 0 AND records_accepted >= 0 AND records_rejected >= 0 AND records_quarantined >= 0
  ),
  CONSTRAINT ingestion_runs_counts_consistent CHECK (
    records_accepted + records_rejected + records_quarantined <= records_received
  ),
  CONSTRAINT ingestion_runs_completion_consistent CHECK (
    (status IN ('completed', 'completed_with_errors', 'failed', 'cancelled') AND completed_at IS NOT NULL)
    OR status IN ('queued', 'running')
  )
);

CREATE INDEX ingestion_runs_source_time_idx
  ON market.ingestion_runs(data_source_id, created_at DESC);
CREATE INDEX ingestion_runs_work_queue_idx
  ON market.ingestion_runs(status, created_at)
  WHERE status IN ('queued', 'running');

CREATE TABLE market.raw_records (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ingestion_run_id uuid NOT NULL REFERENCES market.ingestion_runs(id) ON DELETE CASCADE,
  data_source_id uuid NOT NULL REFERENCES catalog.data_sources(id) ON DELETE RESTRICT,
  external_id text,
  payload jsonb NOT NULL,
  payload_sha256 text NOT NULL,
  processing_status text NOT NULL DEFAULT 'pending',
  processing_error_code text,
  processing_error_detail text,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  purge_after timestamptz NOT NULL,
  CONSTRAINT raw_records_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT raw_records_hash_format CHECK (payload_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT raw_records_status_valid CHECK (
    processing_status IN ('pending', 'processed', 'rejected', 'quarantined')
  ),
  CONSTRAINT raw_records_processed_consistent CHECK (
    (processing_status = 'pending' AND processed_at IS NULL)
    OR (processing_status <> 'pending' AND processed_at IS NOT NULL)
  ),
  CONSTRAINT raw_records_purge_valid CHECK (purge_after > received_at),
  UNIQUE (data_source_id, external_id, payload_sha256)
);

CREATE INDEX raw_records_run_status_idx
  ON market.raw_records(ingestion_run_id, processing_status);
CREATE INDEX raw_records_pending_idx
  ON market.raw_records(received_at)
  WHERE processing_status = 'pending';
CREATE INDEX raw_records_purge_idx ON market.raw_records(purge_after);

CREATE TABLE market.job_postings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data_source_id uuid NOT NULL REFERENCES catalog.data_sources(id) ON DELETE RESTRICT,
  external_id text NOT NULL,
  employer_organization_id uuid REFERENCES catalog.organizations(id) ON DELETE SET NULL,
  duplicate_of_posting_id uuid REFERENCES market.job_postings(id) ON DELETE SET NULL,
  canonical_url text,
  status text NOT NULL DEFAULT 'active',
  first_seen_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_postings_external_id_not_blank CHECK (length(btrim(external_id)) > 0),
  CONSTRAINT job_postings_status_valid CHECK (
    status IN ('active', 'expired', 'closed', 'removed', 'duplicate', 'quarantined')
  ),
  CONSTRAINT job_postings_seen_window_valid CHECK (last_seen_at >= first_seen_at),
  CONSTRAINT job_postings_not_self_duplicate CHECK (
    duplicate_of_posting_id IS NULL OR duplicate_of_posting_id <> id
  ),
  CONSTRAINT job_postings_duplicate_consistent CHECK (
    (status = 'duplicate' AND duplicate_of_posting_id IS NOT NULL)
    OR status <> 'duplicate'
  ),
  UNIQUE (data_source_id, external_id)
);

CREATE INDEX job_postings_employer_status_idx
  ON market.job_postings(employer_organization_id, status);
CREATE INDEX job_postings_active_seen_idx
  ON market.job_postings(last_seen_at DESC)
  WHERE status = 'active';
CREATE INDEX job_postings_duplicate_idx
  ON market.job_postings(duplicate_of_posting_id)
  WHERE duplicate_of_posting_id IS NOT NULL;

CREATE TRIGGER job_postings_set_updated_at
BEFORE UPDATE ON market.job_postings
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE market.job_posting_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_id uuid NOT NULL REFERENCES market.job_postings(id) ON DELETE CASCADE,
  ingestion_run_id uuid NOT NULL REFERENCES market.ingestion_runs(id) ON DELETE RESTRICT,
  version_number integer NOT NULL,
  content_sha256 text NOT NULL,
  title_raw text NOT NULL,
  description_raw text NOT NULL,
  search_vector tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(title_raw, '')), 'A')
    || setweight(to_tsvector('simple', coalesce(description_raw, '')), 'B')
  ) STORED,
  location_raw text,
  location_id uuid REFERENCES catalog.locations(id) ON DELETE SET NULL,
  work_mode text,
  employment_type text,
  experience_min_years numeric(4,1),
  experience_max_years numeric(4,1),
  education_requirement text,
  salary_min numeric(19,4),
  salary_max numeric(19,4),
  salary_currency catalog.currency_code,
  salary_period text,
  salary_disclosure text NOT NULL DEFAULT 'not_disclosed',
  salary_is_gross boolean,
  posted_at timestamptz,
  expires_at timestamptz,
  captured_at timestamptz NOT NULL DEFAULT now(),
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_posting_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT job_posting_versions_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT job_posting_versions_title_not_blank CHECK (length(btrim(title_raw)) BETWEEN 1 AND 500),
  CONSTRAINT job_posting_versions_description_not_blank CHECK (length(btrim(description_raw)) > 0),
  CONSTRAINT job_posting_versions_work_mode_valid CHECK (
    work_mode IS NULL OR work_mode IN ('onsite', 'hybrid', 'remote', 'unspecified')
  ),
  CONSTRAINT job_posting_versions_employment_type_valid CHECK (
    employment_type IS NULL OR employment_type IN ('full_time', 'part_time', 'internship', 'contract', 'temporary', 'apprenticeship', 'freelance', 'unspecified')
  ),
  CONSTRAINT job_posting_versions_experience_valid CHECK (
    (experience_min_years IS NULL OR experience_min_years >= 0)
    AND (experience_max_years IS NULL OR experience_max_years >= 0)
    AND (experience_min_years IS NULL OR experience_max_years IS NULL OR experience_max_years >= experience_min_years)
  ),
  CONSTRAINT job_posting_versions_salary_fields_consistent CHECK (
    (salary_disclosure = 'not_disclosed' AND salary_min IS NULL AND salary_max IS NULL AND salary_currency IS NULL AND salary_period IS NULL)
    OR (
      salary_disclosure IN ('advertised', 'estimated')
      AND (salary_min IS NOT NULL OR salary_max IS NOT NULL)
      AND salary_currency IS NOT NULL
      AND salary_period IS NOT NULL
    )
  ),
  CONSTRAINT job_posting_versions_salary_values_valid CHECK (
    (salary_min IS NULL OR salary_min >= 0)
    AND (salary_max IS NULL OR salary_max >= 0)
    AND (salary_min IS NULL OR salary_max IS NULL OR salary_max >= salary_min)
  ),
  CONSTRAINT job_posting_versions_salary_period_valid CHECK (
    salary_period IS NULL OR salary_period IN ('hour', 'day', 'month', 'year', 'project')
  ),
  CONSTRAINT job_posting_versions_salary_disclosure_valid CHECK (
    salary_disclosure IN ('advertised', 'estimated', 'not_disclosed')
  ),
  CONSTRAINT job_posting_versions_dates_valid CHECK (
    expires_at IS NULL OR posted_at IS NULL OR expires_at >= posted_at
  ),
  UNIQUE (job_posting_id, version_number)
);

CREATE UNIQUE INDEX job_posting_versions_one_current_idx
  ON market.job_posting_versions(job_posting_id)
  WHERE is_current;
CREATE INDEX job_posting_versions_location_time_idx
  ON market.job_posting_versions(location_id, posted_at DESC)
  WHERE is_current;
CREATE INDEX job_posting_versions_salary_idx
  ON market.job_posting_versions(salary_currency, salary_period, salary_min, salary_max)
  WHERE is_current AND salary_disclosure = 'advertised';
CREATE INDEX job_posting_versions_search_idx
  ON market.job_posting_versions USING gin (search_vector);
CREATE INDEX job_posting_versions_content_hash_idx
  ON market.job_posting_versions(job_posting_id, content_sha256);

CREATE TABLE market.job_occupation_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_version_id uuid NOT NULL REFERENCES market.job_posting_versions(id) ON DELETE CASCADE,
  occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE RESTRICT,
  mapping_type text NOT NULL DEFAULT 'primary',
  confidence catalog.score_01 NOT NULL,
  mapping_method text NOT NULL,
  model_release_id uuid REFERENCES governance.model_releases(id) ON DELETE RESTRICT,
  reviewed_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_occupation_mappings_type_valid CHECK (mapping_type IN ('primary', 'secondary')),
  CONSTRAINT job_occupation_mappings_method_valid CHECK (
    mapping_method IN ('rule', 'model', 'manual', 'hybrid')
  ),
  CONSTRAINT job_occupation_mappings_model_consistent CHECK (
    mapping_method NOT IN ('model', 'hybrid') OR model_release_id IS NOT NULL
  ),
  CONSTRAINT job_occupation_mappings_review_status_valid CHECK (
    review_status IN ('pending', 'approved', 'corrected', 'rejected', 'not_required')
  ),
  CONSTRAINT job_occupation_mappings_review_consistent CHECK (
    review_status = 'pending' OR review_status = 'not_required' OR reviewed_at IS NOT NULL
  ),
  UNIQUE (job_posting_version_id, occupation_id, mapping_type)
);

CREATE UNIQUE INDEX job_occupation_mappings_one_primary_idx
  ON market.job_occupation_mappings(job_posting_version_id)
  WHERE mapping_type = 'primary' AND review_status <> 'rejected';
CREATE INDEX job_occupation_mappings_occupation_idx
  ON market.job_occupation_mappings(occupation_id, confidence DESC);

CREATE TABLE market.job_skill_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_version_id uuid NOT NULL REFERENCES market.job_posting_versions(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  requirement_type text NOT NULL,
  raw_phrase text NOT NULL,
  minimum_proficiency catalog.proficiency_0_5,
  minimum_years numeric(4,1),
  confidence catalog.score_01 NOT NULL,
  extraction_method text NOT NULL,
  model_release_id uuid REFERENCES governance.model_releases(id) ON DELETE RESTRICT,
  review_status text NOT NULL DEFAULT 'pending',
  reviewed_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_skill_mentions_requirement_valid CHECK (
    requirement_type IN ('required', 'preferred', 'mentioned', 'tool', 'certification')
  ),
  CONSTRAINT job_skill_mentions_phrase_not_blank CHECK (length(btrim(raw_phrase)) BETWEEN 1 AND 500),
  CONSTRAINT job_skill_mentions_years_valid CHECK (minimum_years IS NULL OR minimum_years >= 0),
  CONSTRAINT job_skill_mentions_method_valid CHECK (
    extraction_method IN ('rule', 'model', 'manual', 'hybrid')
  ),
  CONSTRAINT job_skill_mentions_model_consistent CHECK (
    extraction_method NOT IN ('model', 'hybrid') OR model_release_id IS NOT NULL
  ),
  CONSTRAINT job_skill_mentions_review_status_valid CHECK (
    review_status IN ('pending', 'approved', 'corrected', 'rejected', 'not_required')
  ),
  CONSTRAINT job_skill_mentions_review_consistent CHECK (
    review_status = 'pending' OR review_status = 'not_required' OR reviewed_at IS NOT NULL
  )
);

CREATE INDEX job_skill_mentions_posting_idx
  ON market.job_skill_mentions(job_posting_version_id, requirement_type);
CREATE INDEX job_skill_mentions_skill_idx
  ON market.job_skill_mentions(skill_id, requirement_type, confidence DESC);
CREATE INDEX job_skill_mentions_review_queue_idx
  ON market.job_skill_mentions(confidence, created_at)
  WHERE review_status = 'pending';

CREATE TABLE market.job_quality_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_posting_version_id uuid NOT NULL REFERENCES market.job_posting_versions(id) ON DELETE CASCADE,
  flag_code text NOT NULL,
  severity text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  detection_method text NOT NULL,
  model_release_id uuid REFERENCES governance.model_releases(id) ON DELETE RESTRICT,
  detected_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  resolved_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT job_quality_flags_code_valid CHECK (
    flag_code IN ('duplicate', 'possible_scam', 'salary_outlier', 'missing_core_fields', 'expired', 'ghost_job_risk', 'invalid_location', 'low_content_quality')
  ),
  CONSTRAINT job_quality_flags_severity_valid CHECK (severity IN ('info', 'warning', 'high', 'critical')),
  CONSTRAINT job_quality_flags_details_object CHECK (jsonb_typeof(details) = 'object'),
  CONSTRAINT job_quality_flags_method_valid CHECK (
    detection_method IN ('rule', 'model', 'manual', 'source')
  ),
  CONSTRAINT job_quality_flags_model_consistent CHECK (
    detection_method <> 'model' OR model_release_id IS NOT NULL
  ),
  CONSTRAINT job_quality_flags_status_valid CHECK (status IN ('open', 'confirmed', 'dismissed', 'resolved')),
  CONSTRAINT job_quality_flags_resolution_consistent CHECK (
    status = 'open' OR resolved_at IS NOT NULL
  ),
  UNIQUE (job_posting_version_id, flag_code, detection_method)
);

CREATE INDEX job_quality_flags_open_idx
  ON market.job_quality_flags(severity, created_at)
  WHERE status = 'open';

CREATE TABLE market.labor_market_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id uuid REFERENCES taxonomy.occupations(id) ON DELETE RESTRICT,
  skill_id uuid REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  location_id uuid REFERENCES catalog.locations(id) ON DELETE RESTRICT,
  work_mode text,
  experience_band text,
  window_start date NOT NULL,
  window_end date NOT NULL,
  as_of_at timestamptz NOT NULL,
  posting_count integer NOT NULL,
  unique_posting_count integer NOT NULL,
  unique_employer_count integer NOT NULL,
  demand_index numeric(12,6),
  growth_rate numeric(12,6),
  salary_p25 numeric(19,4),
  salary_p50 numeric(19,4),
  salary_p75 numeric(19,4),
  salary_currency catalog.currency_code,
  salary_period text,
  salary_sample_size integer NOT NULL DEFAULT 0,
  supply_sample_size integer NOT NULL DEFAULT 0,
  shortage_classification text NOT NULL DEFAULT 'not_assessed',
  confidence catalog.score_01 NOT NULL,
  methodology_version text NOT NULL,
  source_freshness_at timestamptz NOT NULL,
  limitations text,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT labor_market_signals_subject_present CHECK (
    occupation_id IS NOT NULL OR skill_id IS NOT NULL
  ),
  CONSTRAINT labor_market_signals_work_mode_valid CHECK (
    work_mode IS NULL OR work_mode IN ('onsite', 'hybrid', 'remote', 'all')
  ),
  CONSTRAINT labor_market_signals_experience_valid CHECK (
    experience_band IS NULL OR experience_band IN ('entry', 'junior', 'mid', 'senior', 'lead', 'all')
  ),
  CONSTRAINT labor_market_signals_window_valid CHECK (window_end >= window_start),
  CONSTRAINT labor_market_signals_counts_valid CHECK (
    posting_count >= 0
    AND unique_posting_count >= 0
    AND unique_employer_count >= 0
    AND salary_sample_size >= 0
    AND supply_sample_size >= 0
    AND unique_posting_count <= posting_count
  ),
  CONSTRAINT labor_market_signals_salary_fields_consistent CHECK (
    (salary_sample_size = 0 AND salary_p25 IS NULL AND salary_p50 IS NULL AND salary_p75 IS NULL)
    OR (
      salary_sample_size > 0
      AND salary_p25 IS NOT NULL
      AND salary_p50 IS NOT NULL
      AND salary_p75 IS NOT NULL
      AND salary_currency IS NOT NULL
      AND salary_period IS NOT NULL
    )
  ),
  CONSTRAINT labor_market_signals_salary_order_valid CHECK (
    salary_p25 IS NULL OR (salary_p25 <= salary_p50 AND salary_p50 <= salary_p75)
  ),
  CONSTRAINT labor_market_signals_salary_period_valid CHECK (
    salary_period IS NULL OR salary_period IN ('hour', 'day', 'month', 'year')
  ),
  CONSTRAINT labor_market_signals_shortage_valid CHECK (
    shortage_classification IN ('not_assessed', 'insufficient_supply_data', 'low', 'moderate', 'high')
  ),
  CONSTRAINT labor_market_signals_shortage_evidence CHECK (
    shortage_classification NOT IN ('low', 'moderate', 'high') OR supply_sample_size > 0
  ),
  CONSTRAINT labor_market_signals_status_valid CHECK (status IN ('draft', 'published', 'superseded', 'rejected')),
  CONSTRAINT labor_market_signals_publish_consistent CHECK (
    (status = 'published' AND published_at IS NOT NULL)
    OR status <> 'published'
  )
);

CREATE INDEX labor_market_signals_occupation_time_idx
  ON market.labor_market_signals(occupation_id, location_id, window_end DESC)
  WHERE status = 'published';
CREATE INDEX labor_market_signals_skill_time_idx
  ON market.labor_market_signals(skill_id, location_id, window_end DESC)
  WHERE status = 'published';
CREATE UNIQUE INDEX labor_market_signals_published_identity_idx
  ON market.labor_market_signals(
    occupation_id,
    skill_id,
    location_id,
    work_mode,
    experience_band,
    window_start,
    window_end,
    methodology_version
  ) NULLS NOT DISTINCT
  WHERE status = 'published';

CREATE TABLE market.signal_source_stats (
  labor_market_signal_id uuid NOT NULL REFERENCES market.labor_market_signals(id) ON DELETE CASCADE,
  data_source_id uuid NOT NULL REFERENCES catalog.data_sources(id) ON DELETE RESTRICT,
  posting_count integer NOT NULL,
  accepted_posting_count integer NOT NULL,
  source_weight catalog.score_01 NOT NULL,
  coverage_start date NOT NULL,
  coverage_end date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (labor_market_signal_id, data_source_id),
  CONSTRAINT signal_source_stats_counts_valid CHECK (
    posting_count >= 0 AND accepted_posting_count >= 0 AND accepted_posting_count <= posting_count
  ),
  CONSTRAINT signal_source_stats_window_valid CHECK (coverage_end >= coverage_start)
);

CREATE TABLE learning.opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_type text NOT NULL,
  provider_organization_id uuid REFERENCES catalog.organizations(id) ON DELETE SET NULL,
  data_source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  external_id text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_type_valid CHECK (
    opportunity_type IN ('university_program', 'college_program', 'vocational_program', 'course', 'certification', 'project', 'competition', 'research', 'internship', 'apprenticeship', 'exploration_activity')
  ),
  CONSTRAINT opportunities_status_valid CHECK (status IN ('draft', 'active', 'inactive', 'expired', 'retired')),
  UNIQUE (data_source_id, external_id)
);

CREATE INDEX opportunities_type_status_idx
  ON learning.opportunities(opportunity_type, status);

CREATE TRIGGER opportunities_set_updated_at
BEFORE UPDATE ON learning.opportunities
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE learning.opportunity_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES learning.opportunities(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  title text NOT NULL,
  description text,
  delivery_mode text,
  location_id uuid REFERENCES catalog.locations(id) ON DELETE SET NULL,
  source_url text,
  duration_hours numeric(10,2),
  duration_weeks numeric(10,2),
  cost_min numeric(19,4),
  cost_max numeric(19,4),
  cost_currency catalog.currency_code,
  enrollment_opens_on date,
  enrollment_closes_on date,
  starts_on date,
  ends_on date,
  eligibility_text text,
  is_sponsored boolean NOT NULL DEFAULT false,
  sponsor_disclosure text,
  verification_status text NOT NULL DEFAULT 'unverified',
  reviewed_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  expires_at timestamptz,
  content_sha256 text NOT NULL,
  is_current boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT opportunity_versions_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 500),
  CONSTRAINT opportunity_versions_delivery_valid CHECK (
    delivery_mode IS NULL OR delivery_mode IN ('onsite', 'online', 'hybrid', 'self_paced', 'unspecified')
  ),
  CONSTRAINT opportunity_versions_duration_valid CHECK (
    (duration_hours IS NULL OR duration_hours > 0)
    AND (duration_weeks IS NULL OR duration_weeks > 0)
  ),
  CONSTRAINT opportunity_versions_cost_consistent CHECK (
    (cost_min IS NULL AND cost_max IS NULL AND cost_currency IS NULL)
    OR (
      (cost_min IS NOT NULL OR cost_max IS NOT NULL)
      AND cost_currency IS NOT NULL
      AND (cost_min IS NULL OR cost_min >= 0)
      AND (cost_max IS NULL OR cost_max >= 0)
      AND (cost_min IS NULL OR cost_max IS NULL OR cost_max >= cost_min)
    )
  ),
  CONSTRAINT opportunity_versions_enrollment_valid CHECK (
    enrollment_closes_on IS NULL OR enrollment_opens_on IS NULL OR enrollment_closes_on >= enrollment_opens_on
  ),
  CONSTRAINT opportunity_versions_schedule_valid CHECK (
    ends_on IS NULL OR starts_on IS NULL OR ends_on >= starts_on
  ),
  CONSTRAINT opportunity_versions_sponsor_consistent CHECK (
    (is_sponsored AND sponsor_disclosure IS NOT NULL)
    OR NOT is_sponsored
  ),
  CONSTRAINT opportunity_versions_verification_valid CHECK (
    verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'stale')
  ),
  CONSTRAINT opportunity_versions_review_consistent CHECK (
    verification_status IN ('unverified', 'pending') OR reviewed_at IS NOT NULL
  ),
  CONSTRAINT opportunity_versions_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT opportunity_versions_expiry_valid CHECK (expires_at IS NULL OR expires_at > created_at),
  UNIQUE (opportunity_id, version_number)
);

CREATE UNIQUE INDEX opportunity_versions_one_current_idx
  ON learning.opportunity_versions(opportunity_id)
  WHERE is_current;
CREATE INDEX opportunity_versions_active_dates_idx
  ON learning.opportunity_versions(enrollment_closes_on, starts_on)
  WHERE is_current AND verification_status = 'verified';
CREATE INDEX opportunity_versions_title_trgm_idx
  ON learning.opportunity_versions USING gin (title gin_trgm_ops);
CREATE INDEX opportunity_versions_content_hash_idx
  ON learning.opportunity_versions(opportunity_id, content_sha256);

CREATE TABLE learning.opportunity_skills (
  opportunity_version_id uuid NOT NULL REFERENCES learning.opportunity_versions(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  relation_type text NOT NULL,
  target_proficiency catalog.proficiency_0_5,
  importance catalog.score_01,
  evidence_basis text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_version_id, skill_id, relation_type),
  CONSTRAINT opportunity_skills_relation_valid CHECK (
    relation_type IN ('prerequisite', 'learning_outcome', 'practiced', 'assessed')
  ),
  CONSTRAINT opportunity_skills_evidence_valid CHECK (
    evidence_basis IN ('provider_claim', 'curriculum_review', 'learner_outcomes', 'expert_review', 'market_evidence')
  )
);

CREATE INDEX opportunity_skills_skill_idx
  ON learning.opportunity_skills(skill_id, relation_type, importance DESC NULLS LAST);

CREATE TABLE learning.opportunity_occupations (
  opportunity_version_id uuid NOT NULL REFERENCES learning.opportunity_versions(id) ON DELETE CASCADE,
  occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE RESTRICT,
  relation_type text NOT NULL,
  relevance catalog.score_01 NOT NULL,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (opportunity_version_id, occupation_id, relation_type),
  CONSTRAINT opportunity_occupations_relation_valid CHECK (
    relation_type IN ('prepares_for', 'leads_to', 'explores', 'upskills_for', 'reskills_for')
  )
);

CREATE INDEX opportunity_occupations_occupation_idx
  ON learning.opportunity_occupations(occupation_id, relevance DESC);

CREATE TABLE governance.data_quality_results (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rule_code text NOT NULL,
  entity_type text NOT NULL,
  entity_id text NOT NULL,
  data_source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  ingestion_run_id uuid REFERENCES market.ingestion_runs(id) ON DELETE SET NULL,
  severity text NOT NULL,
  status text NOT NULL,
  score catalog.score_01,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  evaluated_at timestamptz NOT NULL DEFAULT now(),
  resolved_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  resolved_at timestamptz,
  resolution_note text,
  CONSTRAINT data_quality_results_rule_format CHECK (rule_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  CONSTRAINT data_quality_results_entity_type_valid CHECK (
    entity_type IN ('raw_record', 'job_posting', 'job_posting_version', 'skill_mapping', 'occupation_mapping', 'market_signal', 'learning_opportunity', 'taxonomy_item')
  ),
  CONSTRAINT data_quality_results_severity_valid CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  CONSTRAINT data_quality_results_status_valid CHECK (
    status IN ('passed', 'failed', 'waived', 'resolved')
  ),
  CONSTRAINT data_quality_results_details_object CHECK (jsonb_typeof(details) = 'object'),
  CONSTRAINT data_quality_results_resolution_consistent CHECK (
    status NOT IN ('waived', 'resolved') OR resolved_at IS NOT NULL
  )
);

CREATE INDEX data_quality_results_failed_idx
  ON governance.data_quality_results(entity_type, severity, evaluated_at DESC)
  WHERE status = 'failed';
CREATE INDEX data_quality_results_run_idx
  ON governance.data_quality_results(ingestion_run_id)
  WHERE ingestion_run_id IS NOT NULL;

COMMENT ON TABLE market.raw_records IS
  'Short-lived source payloads. Purge according to source license and purge_after.';
COMMENT ON TABLE market.job_posting_versions IS
  'Immutable content revisions; advertised and estimated salary values remain explicitly distinguishable.';
COMMENT ON TABLE market.labor_market_signals IS
  'Published analytical snapshots with sample size, methodology, source freshness and confidence.';
COMMENT ON TABLE learning.opportunity_versions IS
  'Versioned learning content so a recommendation can cite the exact reviewed version.';

COMMIT;
