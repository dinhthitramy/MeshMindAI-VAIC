BEGIN;

CREATE TABLE taxonomy.releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'draft',
  description text,
  content_sha256 text,
  published_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  published_at timestamptz,
  retired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT taxonomy_releases_status_valid CHECK (status IN ('draft', 'active', 'retired', 'rejected')),
  CONSTRAINT taxonomy_releases_hash_valid CHECK (
    content_sha256 IS NULL OR content_sha256 ~ '^[0-9a-f]{64}$'
  ),
  CONSTRAINT taxonomy_releases_published_consistent CHECK (
    (status IN ('active', 'retired') AND published_at IS NOT NULL)
    OR status IN ('draft', 'rejected')
  ),
  CONSTRAINT taxonomy_releases_retired_consistent CHECK (
    retired_at IS NULL OR (published_at IS NOT NULL AND retired_at >= published_at)
  )
);

CREATE UNIQUE INDEX taxonomy_releases_one_active_idx
  ON taxonomy.releases((status))
  WHERE status = 'active';

CREATE TABLE taxonomy.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  preferred_name_vi text NOT NULL,
  preferred_name_en text,
  skill_type text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'active',
  introduced_in_release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  retired_in_release_id uuid REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skills_code_format CHECK (code ~ '^[a-z][a-z0-9_.-]{1,127}$'),
  CONSTRAINT skills_name_not_blank CHECK (length(btrim(preferred_name_vi)) BETWEEN 1 AND 200),
  CONSTRAINT skills_type_valid CHECK (
    skill_type IN ('technical', 'tool', 'domain_knowledge', 'soft_skill', 'language', 'certification', 'foundational')
  ),
  CONSTRAINT skills_status_valid CHECK (status IN ('active', 'deprecated', 'merged', 'retired')),
  CONSTRAINT skills_retirement_consistent CHECK (
    (status = 'active' AND retired_in_release_id IS NULL)
    OR (status IN ('deprecated', 'merged', 'retired') AND retired_in_release_id IS NOT NULL)
  )
);

CREATE INDEX skills_type_status_idx ON taxonomy.skills(skill_type, status);
CREATE INDEX skills_name_vi_trgm_idx ON taxonomy.skills USING gin (preferred_name_vi gin_trgm_ops);
CREATE INDEX skills_name_en_trgm_idx ON taxonomy.skills USING gin (preferred_name_en gin_trgm_ops);

CREATE TRIGGER skills_set_updated_at
BEFORE UPDATE ON taxonomy.skills
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE taxonomy.skill_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text GENERATED ALWAYS AS (lower(btrim(alias))) STORED,
  locale varchar(10) NOT NULL DEFAULT 'vi-VN',
  alias_type text NOT NULL DEFAULT 'synonym',
  mapping_confidence catalog.score_01 NOT NULL DEFAULT 1,
  source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_aliases_alias_not_blank CHECK (length(btrim(alias)) BETWEEN 1 AND 200),
  CONSTRAINT skill_aliases_type_valid CHECK (
    alias_type IN ('synonym', 'abbreviation', 'translation', 'product_variant', 'misspelling')
  ),
  UNIQUE (skill_id, locale, normalized_alias, release_id)
);

CREATE INDEX skill_aliases_lookup_idx
  ON taxonomy.skill_aliases(locale, normalized_alias)
  WHERE is_active;
CREATE INDEX skill_aliases_trgm_idx
  ON taxonomy.skill_aliases USING gin (normalized_alias gin_trgm_ops);

CREATE TABLE taxonomy.skill_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE CASCADE,
  target_skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  strength catalog.score_01,
  rationale text,
  source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_relations_different_skills CHECK (source_skill_id <> target_skill_id),
  CONSTRAINT skill_relations_type_valid CHECK (
    relation_type IN ('broader', 'narrower', 'related', 'prerequisite', 'commonly_cooccurs', 'supersedes')
  ),
  UNIQUE (source_skill_id, target_skill_id, relation_type, release_id)
);

CREATE INDEX skill_relations_target_idx
  ON taxonomy.skill_relations(target_skill_id, relation_type);

CREATE TABLE taxonomy.occupations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_occupation_id uuid REFERENCES taxonomy.occupations(id) ON DELETE RESTRICT,
  code text NOT NULL UNIQUE,
  preferred_name_vi text NOT NULL,
  preferred_name_en text,
  description text,
  occupation_level text NOT NULL DEFAULT 'role',
  status text NOT NULL DEFAULT 'active',
  introduced_in_release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  retired_in_release_id uuid REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT occupations_code_format CHECK (code ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{1,127}$'),
  CONSTRAINT occupations_name_not_blank CHECK (length(btrim(preferred_name_vi)) BETWEEN 1 AND 250),
  CONSTRAINT occupations_level_valid CHECK (
    occupation_level IN ('family', 'occupation', 'role', 'specialization')
  ),
  CONSTRAINT occupations_status_valid CHECK (status IN ('active', 'deprecated', 'merged', 'retired')),
  CONSTRAINT occupations_not_self_parent CHECK (
    parent_occupation_id IS NULL OR parent_occupation_id <> id
  ),
  CONSTRAINT occupations_retirement_consistent CHECK (
    (status = 'active' AND retired_in_release_id IS NULL)
    OR (status IN ('deprecated', 'merged', 'retired') AND retired_in_release_id IS NOT NULL)
  )
);

CREATE INDEX occupations_parent_idx ON taxonomy.occupations(parent_occupation_id);
CREATE INDEX occupations_level_status_idx ON taxonomy.occupations(occupation_level, status);
CREATE INDEX occupations_name_vi_trgm_idx
  ON taxonomy.occupations USING gin (preferred_name_vi gin_trgm_ops);
CREATE INDEX occupations_name_en_trgm_idx
  ON taxonomy.occupations USING gin (preferred_name_en gin_trgm_ops);

CREATE TRIGGER occupations_set_updated_at
BEFORE UPDATE ON taxonomy.occupations
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE taxonomy.occupation_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE CASCADE,
  alias text NOT NULL,
  normalized_alias text GENERATED ALWAYS AS (lower(btrim(alias))) STORED,
  locale varchar(10) NOT NULL DEFAULT 'vi-VN',
  alias_type text NOT NULL DEFAULT 'job_title',
  mapping_confidence catalog.score_01 NOT NULL DEFAULT 1,
  source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT occupation_aliases_alias_not_blank CHECK (length(btrim(alias)) BETWEEN 1 AND 250),
  CONSTRAINT occupation_aliases_type_valid CHECK (
    alias_type IN ('job_title', 'synonym', 'abbreviation', 'translation', 'legacy_title')
  ),
  UNIQUE (occupation_id, locale, normalized_alias, release_id)
);

CREATE INDEX occupation_aliases_lookup_idx
  ON taxonomy.occupation_aliases(locale, normalized_alias)
  WHERE is_active;
CREATE INDEX occupation_aliases_trgm_idx
  ON taxonomy.occupation_aliases USING gin (normalized_alias gin_trgm_ops);

CREATE TABLE taxonomy.occupation_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE CASCADE,
  task_code text,
  task_text_vi text NOT NULL,
  task_text_en text,
  importance catalog.score_01,
  frequency catalog.score_01,
  source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT occupation_tasks_text_not_blank CHECK (length(btrim(task_text_vi)) BETWEEN 1 AND 1000),
  UNIQUE (occupation_id, task_code, release_id)
);

CREATE INDEX occupation_tasks_occupation_idx
  ON taxonomy.occupation_tasks(occupation_id, release_id)
  WHERE is_active;

CREATE TABLE taxonomy.occupation_skills (
  occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE CASCADE,
  release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  requirement_type text NOT NULL,
  importance catalog.score_01 NOT NULL,
  minimum_proficiency catalog.proficiency_0_5,
  evidence_basis text NOT NULL,
  source_id uuid REFERENCES catalog.data_sources(id) ON DELETE SET NULL,
  sample_size integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (occupation_id, skill_id, release_id, requirement_type),
  CONSTRAINT occupation_skills_requirement_valid CHECK (
    requirement_type IN ('required', 'preferred', 'emerging', 'transferable', 'certification')
  ),
  CONSTRAINT occupation_skills_evidence_valid CHECK (
    evidence_basis IN ('taxonomy_standard', 'job_postings', 'expert_review', 'training_standard', 'mixed')
  ),
  CONSTRAINT occupation_skills_sample_nonnegative CHECK (sample_size IS NULL OR sample_size >= 0)
);

CREATE INDEX occupation_skills_skill_idx
  ON taxonomy.occupation_skills(skill_id, release_id, importance DESC);

CREATE TABLE taxonomy.occupation_relations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE CASCADE,
  target_occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE CASCADE,
  relation_type text NOT NULL,
  transferability catalog.score_01,
  rationale text NOT NULL,
  release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT occupation_relations_different CHECK (source_occupation_id <> target_occupation_id),
  CONSTRAINT occupation_relations_type_valid CHECK (
    relation_type IN ('adjacent', 'progression', 'specialization', 'career_change', 'alternative_title')
  ),
  UNIQUE (source_occupation_id, target_occupation_id, relation_type, release_id)
);

CREATE INDEX occupation_relations_target_idx
  ON taxonomy.occupation_relations(target_occupation_id, relation_type);

CREATE TABLE profile.learner_profiles (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  birth_month smallint,
  birth_year smallint,
  learner_stage text NOT NULL,
  onboarding_status text NOT NULL DEFAULT 'not_started',
  current_location_id uuid REFERENCES catalog.locations(id) ON DELETE SET NULL,
  weekly_available_hours numeric(5,2),
  monthly_learning_budget numeric(19,4),
  budget_currency catalog.currency_code,
  willing_to_relocate boolean,
  preferred_work_modes text[] NOT NULL DEFAULT ARRAY[]::text[],
  support_needs text,
  profile_revision integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_profiles_birth_pair CHECK (
    (birth_month IS NULL AND birth_year IS NULL)
    OR (birth_month BETWEEN 1 AND 12 AND birth_year BETWEEN 1900 AND 2100)
  ),
  CONSTRAINT learner_profiles_stage_valid CHECK (
    learner_stage IN ('lower_secondary', 'upper_secondary', 'vocational_student', 'college_student', 'university_student', 'recent_graduate', 'early_career', 'other')
  ),
  CONSTRAINT learner_profiles_onboarding_valid CHECK (
    onboarding_status IN ('not_started', 'in_progress', 'completed', 'skipped')
  ),
  CONSTRAINT learner_profiles_hours_valid CHECK (
    weekly_available_hours IS NULL OR weekly_available_hours BETWEEN 0 AND 168
  ),
  CONSTRAINT learner_profiles_budget_valid CHECK (
    (monthly_learning_budget IS NULL AND budget_currency IS NULL)
    OR (monthly_learning_budget >= 0 AND budget_currency IS NOT NULL)
  ),
  CONSTRAINT learner_profiles_work_modes_valid CHECK (
    preferred_work_modes <@ ARRAY['onsite', 'hybrid', 'remote']::text[]
  ),
  CONSTRAINT learner_profiles_revision_positive CHECK (profile_revision > 0)
);

CREATE INDEX learner_profiles_stage_idx ON profile.learner_profiles(learner_stage);
CREATE INDEX learner_profiles_location_idx ON profile.learner_profiles(current_location_id);

CREATE TRIGGER learner_profiles_set_updated_at
BEFORE UPDATE ON profile.learner_profiles
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE profile.learner_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  goal_type text NOT NULL,
  occupation_id uuid REFERENCES taxonomy.occupations(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  target_date date,
  priority smallint NOT NULL DEFAULT 3,
  status text NOT NULL DEFAULT 'active',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_goals_type_valid CHECK (
    goal_type IN ('explore_career', 'choose_education', 'build_skill', 'find_internship', 'find_first_job', 'career_progression')
  ),
  CONSTRAINT learner_goals_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT learner_goals_priority_valid CHECK (priority BETWEEN 1 AND 5),
  CONSTRAINT learner_goals_status_valid CHECK (status IN ('draft', 'active', 'paused', 'completed', 'abandoned')),
  CONSTRAINT learner_goals_completion_consistent CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR status <> 'completed'
  )
);

CREATE INDEX learner_goals_active_idx
  ON profile.learner_goals(learner_user_id, priority, created_at DESC)
  WHERE status = 'active';

CREATE TRIGGER learner_goals_set_updated_at
BEFORE UPDATE ON profile.learner_goals
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE profile.preference_dimensions (
  code text PRIMARY KEY,
  category text NOT NULL,
  name_vi text NOT NULL,
  name_en text,
  description text NOT NULL,
  ranking_eligible boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT preference_dimensions_code_format CHECK (code ~ '^[a-z][a-z0-9_.]{1,63}$'),
  CONSTRAINT preference_dimensions_category_valid CHECK (
    category IN ('interest', 'work_value', 'work_environment', 'task_preference', 'decision_priority')
  )
);

INSERT INTO profile.preference_dimensions
  (code, category, name_vi, description, ranking_eligible)
VALUES
  ('priority.income', 'decision_priority', 'Thu nhập', 'Mức quan trọng của thu nhập trong quyết định.', true),
  ('priority.stability', 'decision_priority', 'Ổn định', 'Mức quan trọng của sự ổn định nghề nghiệp.', true),
  ('priority.creativity', 'decision_priority', 'Sáng tạo', 'Mức quan trọng của cơ hội sáng tạo.', true),
  ('priority.social_impact', 'decision_priority', 'Tác động xã hội', 'Mức quan trọng của tác động tích cực.', true),
  ('priority.work_life_balance', 'decision_priority', 'Cân bằng cuộc sống', 'Mức quan trọng của cân bằng công việc và cuộc sống.', true),
  ('priority.autonomy', 'decision_priority', 'Tự chủ', 'Mức quan trọng của quyền tự chủ khi làm việc.', true),
  ('environment.teamwork', 'work_environment', 'Làm việc nhóm', 'Mức yêu thích môi trường cộng tác.', true),
  ('environment.remote', 'work_environment', 'Làm việc từ xa', 'Mức yêu thích hình thức làm việc từ xa.', true);

CREATE TABLE profile.learner_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  dimension_code text NOT NULL REFERENCES profile.preference_dimensions(code) ON DELETE RESTRICT,
  affinity catalog.score_01 NOT NULL,
  importance catalog.score_01 NOT NULL,
  confidence catalog.score_01 NOT NULL,
  source_type text NOT NULL,
  source_reference text,
  supersedes_preference_id uuid REFERENCES profile.learner_preferences(id) ON DELETE RESTRICT,
  observed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_preferences_source_valid CHECK (
    source_type IN ('self_report', 'conversation', 'assessment', 'behavior', 'counselor', 'system_inference')
  ),
  CONSTRAINT learner_preferences_not_self_supersede CHECK (
    supersedes_preference_id IS NULL OR supersedes_preference_id <> id
  )
);

CREATE INDEX learner_preferences_current_lookup_idx
  ON profile.learner_preferences(learner_user_id, dimension_code, observed_at DESC);

CREATE TABLE profile.learner_location_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES catalog.locations(id) ON DELETE CASCADE,
  context_type text NOT NULL,
  preference_level smallint NOT NULL DEFAULT 3,
  remote_acceptable boolean NOT NULL DEFAULT true,
  relocation_required_acceptable boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learner_location_context_valid CHECK (context_type IN ('study', 'internship', 'employment')),
  CONSTRAINT learner_location_preference_valid CHECK (preference_level BETWEEN 1 AND 5),
  UNIQUE (learner_user_id, location_id, context_type)
);

CREATE INDEX learner_location_preferences_location_idx
  ON profile.learner_location_preferences(location_id, context_type);

CREATE TRIGGER learner_location_preferences_set_updated_at
BEFORE UPDATE ON profile.learner_location_preferences
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE profile.education_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  institution_id uuid REFERENCES catalog.organizations(id) ON DELETE SET NULL,
  institution_name_raw text,
  education_level text NOT NULL,
  program_name text,
  field_of_study text,
  start_date date,
  end_date date,
  status text NOT NULL,
  grade_summary text,
  verification_status text NOT NULL DEFAULT 'self_reported',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT education_records_institution_present CHECK (
    institution_id IS NOT NULL OR institution_name_raw IS NOT NULL
  ),
  CONSTRAINT education_records_level_valid CHECK (
    education_level IN ('lower_secondary', 'upper_secondary', 'vocational', 'college', 'bachelor', 'master', 'doctorate', 'short_course', 'other')
  ),
  CONSTRAINT education_records_status_valid CHECK (
    status IN ('planned', 'enrolled', 'completed', 'paused', 'withdrawn')
  ),
  CONSTRAINT education_records_dates_valid CHECK (
    end_date IS NULL OR start_date IS NULL OR end_date >= start_date
  ),
  CONSTRAINT education_records_verification_valid CHECK (
    verification_status IN ('self_reported', 'document_uploaded', 'verified', 'rejected')
  )
);

CREATE INDEX education_records_learner_idx
  ON profile.education_records(learner_user_id, start_date DESC NULLS LAST);

CREATE TRIGGER education_records_set_updated_at
BEFORE UPDATE ON profile.education_records
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE profile.academic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  education_record_id uuid NOT NULL REFERENCES profile.education_records(id) ON DELETE CASCADE,
  subject_name text NOT NULL,
  result_value numeric(10,4),
  result_text text,
  scale_min numeric(10,4),
  scale_max numeric(10,4),
  period_label text,
  observed_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT academic_results_value_present CHECK (result_value IS NOT NULL OR result_text IS NOT NULL),
  CONSTRAINT academic_results_scale_valid CHECK (
    (scale_min IS NULL AND scale_max IS NULL)
    OR (scale_min IS NOT NULL AND scale_max IS NOT NULL AND scale_max > scale_min)
  ),
  CONSTRAINT academic_results_value_within_scale CHECK (
    result_value IS NULL OR scale_min IS NULL OR result_value BETWEEN scale_min AND scale_max
  )
);

CREATE INDEX academic_results_education_idx
  ON profile.academic_results(education_record_id, observed_at DESC NULLS LAST);

CREATE TABLE profile.evidence_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  title text NOT NULL,
  description text,
  issuer_organization_id uuid REFERENCES catalog.organizations(id) ON DELETE SET NULL,
  source_type text NOT NULL,
  source_url text,
  occurred_on date,
  verification_status text NOT NULL DEFAULT 'self_reported',
  visibility text NOT NULL DEFAULT 'private',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_items_type_valid CHECK (
    evidence_type IN ('project', 'portfolio', 'academic_result', 'certificate', 'assessment', 'mini_task', 'activity', 'work_experience', 'research', 'award', 'reflection', 'language')
  ),
  CONSTRAINT evidence_items_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT evidence_items_source_valid CHECK (
    source_type IN ('self_report', 'uploaded_document', 'external_url', 'system_activity', 'provider_feed', 'counselor_observation')
  ),
  CONSTRAINT evidence_items_verification_valid CHECK (
    verification_status IN ('self_reported', 'pending', 'verified', 'partially_verified', 'rejected', 'expired')
  ),
  CONSTRAINT evidence_items_visibility_valid CHECK (visibility IN ('private', 'shared', 'public_link')),
  CONSTRAINT evidence_items_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX evidence_items_learner_type_idx
  ON profile.evidence_items(learner_user_id, evidence_type, occurred_on DESC NULLS LAST)
  WHERE deleted_at IS NULL;
CREATE INDEX evidence_items_verification_queue_idx
  ON profile.evidence_items(verification_status, created_at)
  WHERE verification_status = 'pending' AND deleted_at IS NULL;

CREATE TRIGGER evidence_items_set_updated_at
BEFORE UPDATE ON profile.evidence_items
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE profile.evidence_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_item_id uuid NOT NULL REFERENCES profile.evidence_items(id) ON DELETE CASCADE,
  object_key text NOT NULL UNIQUE,
  original_file_name text NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL,
  sha256 text NOT NULL,
  malware_scan_status text NOT NULL DEFAULT 'pending',
  scanned_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT evidence_assets_size_valid CHECK (byte_size > 0),
  CONSTRAINT evidence_assets_hash_format CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT evidence_assets_scan_status_valid CHECK (
    malware_scan_status IN ('pending', 'clean', 'infected', 'failed')
  ),
  CONSTRAINT evidence_assets_scan_time_consistent CHECK (
    (malware_scan_status = 'pending' AND scanned_at IS NULL)
    OR malware_scan_status <> 'pending'
  )
);

CREATE INDEX evidence_assets_item_idx ON profile.evidence_assets(evidence_item_id);

CREATE TABLE profile.skill_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  source_type text NOT NULL,
  evidence_item_id uuid REFERENCES profile.evidence_items(id) ON DELETE SET NULL,
  observer_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  proficiency_level catalog.proficiency_0_5,
  confidence catalog.score_01 NOT NULL,
  assessment_method text,
  source_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  observed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  retracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT skill_observations_source_valid CHECK (
    source_type IN ('self_assessment', 'evidence', 'mini_task', 'academic_result', 'counselor_assessment', 'system_inference')
  ),
  CONSTRAINT skill_observations_source_reference CHECK (
    source_type NOT IN ('evidence', 'mini_task', 'academic_result') OR evidence_item_id IS NOT NULL
  ),
  CONSTRAINT skill_observations_expiry_valid CHECK (expires_at IS NULL OR expires_at > observed_at),
  CONSTRAINT skill_observations_retraction_valid CHECK (retracted_at IS NULL OR retracted_at >= observed_at),
  CONSTRAINT skill_observations_source_detail_object CHECK (jsonb_typeof(source_detail) = 'object')
);

CREATE INDEX skill_observations_current_idx
  ON profile.skill_observations(learner_user_id, skill_id, observed_at DESC)
  WHERE retracted_at IS NULL;
CREATE INDEX skill_observations_evidence_idx
  ON profile.skill_observations(evidence_item_id)
  WHERE evidence_item_id IS NOT NULL;

CREATE TABLE profile.skill_summaries (
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  self_reported_level catalog.proficiency_0_5,
  evidence_backed_level catalog.proficiency_0_5,
  inferred_level catalog.proficiency_0_5,
  combined_level catalog.proficiency_0_5 NOT NULL,
  confidence catalog.score_01 NOT NULL,
  active_observation_count integer NOT NULL DEFAULT 0,
  latest_observation_at timestamptz,
  algorithm_version text NOT NULL,
  calculated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (learner_user_id, skill_id),
  CONSTRAINT skill_summaries_count_nonnegative CHECK (active_observation_count >= 0)
);

CREATE INDEX skill_summaries_skill_level_idx
  ON profile.skill_summaries(skill_id, combined_level DESC, confidence DESC);

CREATE TABLE profile.profile_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  profile_revision integer NOT NULL,
  snapshot_data jsonb NOT NULL,
  content_sha256 text NOT NULL,
  purpose text NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_snapshots_revision_positive CHECK (profile_revision > 0),
  CONSTRAINT profile_snapshots_data_object CHECK (jsonb_typeof(snapshot_data) = 'object'),
  CONSTRAINT profile_snapshots_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT profile_snapshots_purpose_valid CHECK (
    purpose IN ('recommendation', 'counseling', 'export', 'audit_reproduction')
  ),
  CONSTRAINT profile_snapshots_expiry_valid CHECK (expires_at > created_at),
  UNIQUE (learner_user_id, profile_revision, purpose)
);

CREATE INDEX profile_snapshots_expiry_idx ON profile.profile_snapshots(expires_at);

COMMENT ON TABLE profile.skill_observations IS
  'Append-only skill claims or measurements; self-report, evidence and inference remain distinguishable.';
COMMENT ON TABLE profile.skill_summaries IS
  'Rebuildable current projection for fast matching; observations remain the source of truth.';
COMMENT ON TABLE profile.profile_snapshots IS
  'Immutable, time-limited snapshot used to reproduce recommendations and counseling views.';

COMMIT;
