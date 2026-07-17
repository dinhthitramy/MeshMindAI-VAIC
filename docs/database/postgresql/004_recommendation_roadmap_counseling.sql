BEGIN;

CREATE TABLE recommendation.runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  profile_snapshot_id uuid NOT NULL REFERENCES profile.profile_snapshots(id) ON DELETE RESTRICT,
  model_release_id uuid NOT NULL REFERENCES governance.model_releases(id) ON DELETE RESTRICT,
  taxonomy_release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  trigger_type text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  market_data_as_of timestamptz NOT NULL,
  input_sha256 text NOT NULL,
  run_configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  failure_detail text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_runs_trigger_valid CHECK (
    trigger_type IN ('onboarding', 'profile_change', 'preference_change', 'market_change', 'manual_refresh', 'counterfactual')
  ),
  CONSTRAINT recommendation_runs_status_valid CHECK (
    status IN ('queued', 'running', 'completed', 'completed_with_warnings', 'failed', 'cancelled')
  ),
  CONSTRAINT recommendation_runs_hash_format CHECK (input_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT recommendation_runs_configuration_object CHECK (jsonb_typeof(run_configuration) = 'object'),
  CONSTRAINT recommendation_runs_completion_consistent CHECK (
    (status IN ('completed', 'completed_with_warnings', 'failed', 'cancelled') AND completed_at IS NOT NULL)
    OR status IN ('queued', 'running')
  ),
  CONSTRAINT recommendation_runs_failure_consistent CHECK (
    (status = 'failed' AND failure_code IS NOT NULL)
    OR status <> 'failed'
  )
);

CREATE INDEX recommendation_runs_learner_time_idx
  ON recommendation.runs(learner_user_id, created_at DESC);
CREATE INDEX recommendation_runs_work_queue_idx
  ON recommendation.runs(status, created_at)
  WHERE status IN ('queued', 'running');

CREATE TABLE recommendation.career_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_run_id uuid NOT NULL REFERENCES recommendation.runs(id) ON DELETE CASCADE,
  occupation_id uuid NOT NULL REFERENCES taxonomy.occupations(id) ON DELETE RESTRICT,
  option_category text NOT NULL,
  display_rank smallint NOT NULL,
  retrieval_score catalog.score_01,
  confidence catalog.score_01 NOT NULL,
  state text NOT NULL DEFAULT 'ready',
  summary text NOT NULL,
  uncertainty_summary text NOT NULL,
  disclaimer_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT career_options_category_valid CHECK (
    option_category IN ('current_fit', 'adjacent', 'stretch', 'exploration')
  ),
  CONSTRAINT career_options_rank_positive CHECK (display_rank > 0),
  CONSTRAINT career_options_state_valid CHECK (
    state IN ('draft', 'ready', 'withheld_quality', 'superseded')
  ),
  CONSTRAINT career_options_summary_not_blank CHECK (length(btrim(summary)) > 0),
  CONSTRAINT career_options_uncertainty_not_blank CHECK (length(btrim(uncertainty_summary)) > 0),
  CONSTRAINT career_options_disclaimer_not_blank CHECK (length(btrim(disclaimer_text)) > 0),
  UNIQUE (recommendation_run_id, occupation_id),
  UNIQUE (recommendation_run_id, display_rank)
);

CREATE INDEX career_options_run_category_idx
  ON recommendation.career_options(recommendation_run_id, option_category, display_rank);
CREATE INDEX career_options_occupation_idx
  ON recommendation.career_options(occupation_id, created_at DESC);

CREATE TABLE recommendation.option_dimensions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  dimension_code text NOT NULL,
  score catalog.score_01,
  confidence catalog.score_01 NOT NULL,
  display_label text NOT NULL,
  explanation text NOT NULL,
  sort_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_dimensions_code_valid CHECK (
    dimension_code IN ('interest_values', 'evidence_strength', 'gap_learnability', 'market_demand', 'personal_feasibility', 'data_uncertainty')
  ),
  CONSTRAINT option_dimensions_sort_positive CHECK (sort_order > 0),
  CONSTRAINT option_dimensions_explanation_not_blank CHECK (length(btrim(explanation)) > 0),
  UNIQUE (career_option_id, dimension_code),
  UNIQUE (career_option_id, sort_order)
);

CREATE TABLE recommendation.option_reasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  reason_type text NOT NULL,
  statement text NOT NULL,
  confidence catalog.score_01 NOT NULL,
  sort_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_reasons_type_valid CHECK (
    reason_type IN ('why_fit', 'skill_strength', 'skill_gap', 'market_evidence', 'tradeoff', 'uncertainty', 'exploration_step', 'alternative_route')
  ),
  CONSTRAINT option_reasons_statement_not_blank CHECK (length(btrim(statement)) > 0),
  CONSTRAINT option_reasons_sort_positive CHECK (sort_order > 0),
  UNIQUE (career_option_id, sort_order)
);

CREATE INDEX option_reasons_type_idx
  ON recommendation.option_reasons(career_option_id, reason_type);

CREATE TABLE recommendation.option_evidence_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  option_reason_id uuid REFERENCES recommendation.option_reasons(id) ON DELETE CASCADE,
  evidence_item_id uuid REFERENCES profile.evidence_items(id) ON DELETE RESTRICT,
  skill_observation_id uuid REFERENCES profile.skill_observations(id) ON DELETE RESTRICT,
  contribution_direction text NOT NULL,
  contribution_weight catalog.score_01,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_evidence_links_source_present CHECK (
    evidence_item_id IS NOT NULL OR skill_observation_id IS NOT NULL
  ),
  CONSTRAINT option_evidence_links_direction_valid CHECK (
    contribution_direction IN ('supports', 'weakens', 'context_only')
  ),
  CONSTRAINT option_evidence_links_explanation_not_blank CHECK (length(btrim(explanation)) > 0)
);

CREATE INDEX option_evidence_links_option_idx
  ON recommendation.option_evidence_links(career_option_id);
CREATE INDEX option_evidence_links_evidence_idx
  ON recommendation.option_evidence_links(evidence_item_id)
  WHERE evidence_item_id IS NOT NULL;

CREATE TABLE recommendation.option_market_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  option_reason_id uuid REFERENCES recommendation.option_reasons(id) ON DELETE CASCADE,
  labor_market_signal_id uuid NOT NULL REFERENCES market.labor_market_signals(id) ON DELETE RESTRICT,
  usage_type text NOT NULL,
  explanation text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_market_links_usage_valid CHECK (
    usage_type IN ('demand', 'growth', 'salary', 'location', 'skill_demand', 'risk', 'context_only')
  ),
  CONSTRAINT option_market_links_explanation_not_blank CHECK (length(btrim(explanation)) > 0),
  UNIQUE (career_option_id, labor_market_signal_id, usage_type)
);

CREATE INDEX option_market_links_signal_idx
  ON recommendation.option_market_links(labor_market_signal_id);

CREATE TABLE recommendation.option_skill_gaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  current_proficiency numeric(5,2),
  required_proficiency catalog.proficiency_0_5 NOT NULL,
  gap_size numeric(5,2) NOT NULL,
  priority text NOT NULL,
  confidence catalog.score_01 NOT NULL,
  validation_action text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_skill_gaps_current_valid CHECK (
    current_proficiency IS NULL OR current_proficiency BETWEEN 0 AND 5
  ),
  CONSTRAINT option_skill_gaps_size_valid CHECK (gap_size BETWEEN 0 AND 5),
  CONSTRAINT option_skill_gaps_size_consistent CHECK (
    current_proficiency IS NULL
    OR abs(gap_size - greatest(required_proficiency::numeric - current_proficiency, 0)) < 0.01
  ),
  CONSTRAINT option_skill_gaps_priority_valid CHECK (priority IN ('required', 'recommended', 'optional')),
  UNIQUE (career_option_id, skill_id)
);

CREATE INDEX option_skill_gaps_priority_idx
  ON recommendation.option_skill_gaps(career_option_id, priority, gap_size DESC);

CREATE TABLE recommendation.option_learning_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  opportunity_version_id uuid NOT NULL REFERENCES learning.opportunity_versions(id) ON DELETE RESTRICT,
  route_type text NOT NULL,
  relevance catalog.score_01 NOT NULL,
  estimated_duration_months numeric(7,2),
  estimated_cost numeric(19,4),
  estimated_cost_currency catalog.currency_code,
  tradeoff_summary text NOT NULL,
  sort_order smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_learning_links_route_valid CHECK (
    route_type IN ('university', 'college', 'vocational', 'certificate', 'self_study', 'project_based', 'combined', 'exploration')
  ),
  CONSTRAINT option_learning_links_duration_valid CHECK (
    estimated_duration_months IS NULL OR estimated_duration_months > 0
  ),
  CONSTRAINT option_learning_links_cost_consistent CHECK (
    (estimated_cost IS NULL AND estimated_cost_currency IS NULL)
    OR (estimated_cost >= 0 AND estimated_cost_currency IS NOT NULL)
  ),
  CONSTRAINT option_learning_links_tradeoff_not_blank CHECK (length(btrim(tradeoff_summary)) > 0),
  CONSTRAINT option_learning_links_sort_positive CHECK (sort_order > 0),
  UNIQUE (career_option_id, opportunity_version_id),
  UNIQUE (career_option_id, sort_order)
);

CREATE TABLE recommendation.option_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  stance text NOT NULL,
  reason_code text,
  comment text,
  retracted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT option_feedback_stance_valid CHECK (stance IN ('interested', 'not_interested', 'unsure', 'saved')),
  CONSTRAINT option_feedback_reason_valid CHECK (
    reason_code IS NULL OR reason_code IN ('interest_mismatch', 'skill_gap', 'cost', 'time', 'location', 'work_conditions', 'market_risk', 'already_known', 'want_to_explore', 'other')
  ),
  CONSTRAINT option_feedback_retraction_valid CHECK (retracted_at IS NULL OR retracted_at >= created_at)
);

CREATE INDEX option_feedback_option_time_idx
  ON recommendation.option_feedback(career_option_id, created_at DESC)
  WHERE retracted_at IS NULL;
CREATE INDEX option_feedback_user_time_idx
  ON recommendation.option_feedback(user_id, created_at DESC)
  WHERE retracted_at IS NULL;

CREATE TABLE roadmap.roadmaps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  learner_goal_id uuid REFERENCES profile.learner_goals(id) ON DELETE SET NULL,
  source_career_option_id uuid REFERENCES recommendation.career_options(id) ON DELETE SET NULL,
  title text NOT NULL,
  primary_stage text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  current_version_id uuid,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roadmaps_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT roadmaps_stage_valid CHECK (primary_stage IN ('learning', 'internship', 'employment', 'career_progression')),
  CONSTRAINT roadmaps_status_valid CHECK (status IN ('draft', 'active', 'paused', 'completed', 'archived')),
  CONSTRAINT roadmaps_archive_consistent CHECK (
    (status = 'archived' AND archived_at IS NOT NULL)
    OR status <> 'archived'
  )
);

CREATE INDEX roadmaps_learner_status_idx
  ON roadmap.roadmaps(learner_user_id, status, updated_at DESC);

CREATE TRIGGER roadmaps_set_updated_at
BEFORE UPDATE ON roadmap.roadmaps
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE roadmap.roadmap_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES roadmap.roadmaps(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  based_on_version_id uuid REFERENCES roadmap.roadmap_versions(id) ON DELETE RESTRICT,
  authored_by_type text NOT NULL,
  authored_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  generated_by_model_release_id uuid REFERENCES governance.model_releases(id) ON DELETE RESTRICT,
  change_reason text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roadmap_versions_number_positive CHECK (version_number > 0),
  CONSTRAINT roadmap_versions_author_type_valid CHECK (
    authored_by_type IN ('learner', 'counselor', 'ai', 'collaborative')
  ),
  CONSTRAINT roadmap_versions_author_consistent CHECK (
    (authored_by_type = 'ai' AND generated_by_model_release_id IS NOT NULL)
    OR authored_by_type <> 'ai'
  ),
  CONSTRAINT roadmap_versions_reason_not_blank CHECK (length(btrim(change_reason)) > 0),
  CONSTRAINT roadmap_versions_status_valid CHECK (status IN ('draft', 'published', 'superseded', 'rejected')),
  CONSTRAINT roadmap_versions_publish_consistent CHECK (
    (status IN ('published', 'superseded') AND published_at IS NOT NULL)
    OR status IN ('draft', 'rejected')
  ),
  UNIQUE (roadmap_id, version_number)
);

ALTER TABLE roadmap.roadmaps
  ADD CONSTRAINT roadmaps_current_version_fk
  FOREIGN KEY (current_version_id)
  REFERENCES roadmap.roadmap_versions(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX roadmap_versions_one_published_idx
  ON roadmap.roadmap_versions(roadmap_id)
  WHERE status = 'published';

CREATE TABLE roadmap.milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_version_id uuid NOT NULL REFERENCES roadmap.roadmap_versions(id) ON DELETE CASCADE,
  supersedes_milestone_id uuid REFERENCES roadmap.milestones(id) ON DELETE SET NULL,
  stage text NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  necessity text NOT NULL,
  planned_start_on date,
  planned_due_on date,
  estimated_effort_hours numeric(8,2),
  completion_criteria text NOT NULL,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT milestones_stage_valid CHECK (stage IN ('learning', 'internship', 'employment', 'career_progression')),
  CONSTRAINT milestones_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT milestones_description_not_blank CHECK (length(btrim(description)) > 0),
  CONSTRAINT milestones_necessity_valid CHECK (necessity IN ('required', 'recommended', 'optional')),
  CONSTRAINT milestones_dates_valid CHECK (
    planned_due_on IS NULL OR planned_start_on IS NULL OR planned_due_on >= planned_start_on
  ),
  CONSTRAINT milestones_effort_valid CHECK (
    estimated_effort_hours IS NULL OR estimated_effort_hours > 0
  ),
  CONSTRAINT milestones_criteria_not_blank CHECK (length(btrim(completion_criteria)) > 0),
  CONSTRAINT milestones_sort_positive CHECK (sort_order > 0),
  CONSTRAINT milestones_not_self_supersede CHECK (
    supersedes_milestone_id IS NULL OR supersedes_milestone_id <> id
  ),
  UNIQUE (roadmap_version_id, sort_order)
);

CREATE INDEX milestones_version_stage_idx
  ON roadmap.milestones(roadmap_version_id, stage, sort_order);

CREATE TABLE roadmap.milestone_dependencies (
  milestone_id uuid NOT NULL REFERENCES roadmap.milestones(id) ON DELETE CASCADE,
  depends_on_milestone_id uuid NOT NULL REFERENCES roadmap.milestones(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'finish_to_start',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, depends_on_milestone_id),
  CONSTRAINT milestone_dependencies_different CHECK (milestone_id <> depends_on_milestone_id),
  CONSTRAINT milestone_dependencies_type_valid CHECK (
    dependency_type IN ('finish_to_start', 'start_to_start', 'evidence_required')
  )
);

CREATE INDEX milestone_dependencies_reverse_idx
  ON roadmap.milestone_dependencies(depends_on_milestone_id);

CREATE TABLE roadmap.milestone_skills (
  milestone_id uuid NOT NULL REFERENCES roadmap.milestones(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES taxonomy.skills(id) ON DELETE RESTRICT,
  purpose text NOT NULL,
  target_proficiency catalog.proficiency_0_5,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, skill_id, purpose),
  CONSTRAINT milestone_skills_purpose_valid CHECK (purpose IN ('prerequisite', 'develop', 'practice', 'prove'))
);

CREATE INDEX milestone_skills_skill_idx ON roadmap.milestone_skills(skill_id, purpose);

CREATE TABLE roadmap.milestone_evidence_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id uuid NOT NULL REFERENCES roadmap.milestones(id) ON DELETE CASCADE,
  evidence_type text NOT NULL,
  requirement_text text NOT NULL,
  minimum_count integer NOT NULL DEFAULT 1,
  rubric jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT milestone_evidence_type_valid CHECK (
    evidence_type IN ('project', 'portfolio', 'academic_result', 'certificate', 'assessment', 'mini_task', 'activity', 'work_experience', 'research', 'award', 'reflection', 'language')
  ),
  CONSTRAINT milestone_evidence_text_not_blank CHECK (length(btrim(requirement_text)) > 0),
  CONSTRAINT milestone_evidence_count_positive CHECK (minimum_count > 0),
  CONSTRAINT milestone_evidence_rubric_object CHECK (jsonb_typeof(rubric) = 'object')
);

CREATE INDEX milestone_evidence_requirements_idx
  ON roadmap.milestone_evidence_requirements(milestone_id);

CREATE TABLE roadmap.progress_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roadmap_id uuid NOT NULL REFERENCES roadmap.roadmaps(id) ON DELETE CASCADE,
  milestone_id uuid NOT NULL REFERENCES roadmap.milestones(id) ON DELETE CASCADE,
  actor_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  status text NOT NULL,
  completion_percent numeric(5,2) NOT NULL,
  note text,
  blocker_text text,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT progress_events_status_valid CHECK (
    status IN ('not_started', 'in_progress', 'blocked', 'submitted', 'completed', 'skipped')
  ),
  CONSTRAINT progress_events_percent_valid CHECK (completion_percent BETWEEN 0 AND 100),
  CONSTRAINT progress_events_completed_consistent CHECK (
    status <> 'completed' OR completion_percent = 100
  ),
  CONSTRAINT progress_events_blocked_consistent CHECK (
    status <> 'blocked' OR blocker_text IS NOT NULL
  )
);

CREATE INDEX progress_events_milestone_time_idx
  ON roadmap.progress_events(milestone_id, occurred_at DESC);
CREATE INDEX progress_events_roadmap_time_idx
  ON roadmap.progress_events(roadmap_id, occurred_at DESC);

CREATE TABLE roadmap.milestone_evidence_links (
  milestone_id uuid NOT NULL REFERENCES roadmap.milestones(id) ON DELETE CASCADE,
  evidence_item_id uuid NOT NULL REFERENCES profile.evidence_items(id) ON DELETE RESTRICT,
  review_status text NOT NULL DEFAULT 'submitted',
  reviewed_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (milestone_id, evidence_item_id),
  CONSTRAINT milestone_evidence_links_status_valid CHECK (
    review_status IN ('submitted', 'accepted', 'changes_requested', 'rejected')
  ),
  CONSTRAINT milestone_evidence_links_review_consistent CHECK (
    review_status = 'submitted' OR reviewed_at IS NOT NULL
  )
);

CREATE TABLE counseling.relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES profile.learner_profiles(user_id) ON DELETE CASCADE,
  counselor_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  share_grant_id uuid NOT NULL REFERENCES privacy.share_grants(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT counseling_relationships_different_users CHECK (learner_user_id <> counselor_user_id),
  CONSTRAINT counseling_relationships_status_valid CHECK (
    status IN ('pending', 'active', 'paused', 'ended', 'rejected')
  ),
  CONSTRAINT counseling_relationships_start_consistent CHECK (
    status IN ('pending', 'rejected') OR started_at IS NOT NULL
  ),
  CONSTRAINT counseling_relationships_end_consistent CHECK (
    (status = 'ended' AND ended_at IS NOT NULL)
    OR status <> 'ended'
  ),
  UNIQUE (learner_user_id, counselor_user_id, share_grant_id)
);

CREATE INDEX counseling_relationships_counselor_active_idx
  ON counseling.relationships(counselor_user_id, learner_user_id)
  WHERE status = 'active';

CREATE TRIGGER counseling_relationships_set_updated_at
BEFORE UPDATE ON counseling.relationships
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE counseling.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES counseling.relationships(id) ON DELETE CASCADE,
  scheduled_start_at timestamptz NOT NULL,
  scheduled_end_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'scheduled',
  agenda text,
  meeting_reference text,
  cancellation_reason text,
  created_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT appointments_window_valid CHECK (scheduled_end_at > scheduled_start_at),
  CONSTRAINT appointments_status_valid CHECK (
    status IN ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled')
  ),
  CONSTRAINT appointments_cancel_consistent CHECK (
    status <> 'cancelled' OR cancellation_reason IS NOT NULL
  )
);

CREATE INDEX appointments_relationship_time_idx
  ON counseling.appointments(relationship_id, scheduled_start_at DESC);
CREATE INDEX appointments_upcoming_idx
  ON counseling.appointments(scheduled_start_at)
  WHERE status IN ('scheduled', 'confirmed');

CREATE TRIGGER appointments_set_updated_at
BEFORE UPDATE ON counseling.appointments
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE counseling.session_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES counseling.appointments(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  visibility text NOT NULL,
  note_text text NOT NULL,
  learner_notified_at timestamptz,
  learner_acknowledged_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT session_notes_visibility_valid CHECK (
    visibility IN ('shared_with_learner', 'counselor_only', 'learner_only')
  ),
  CONSTRAINT session_notes_text_not_blank CHECK (length(btrim(note_text)) > 0),
  CONSTRAINT session_notes_notification_consistent CHECK (
    visibility <> 'counselor_only' OR learner_notified_at IS NOT NULL
  ),
  CONSTRAINT session_notes_ack_valid CHECK (
    learner_acknowledged_at IS NULL
    OR (learner_notified_at IS NOT NULL AND learner_acknowledged_at >= learner_notified_at)
  )
);

CREATE INDEX session_notes_appointment_idx
  ON counseling.session_notes(appointment_id, created_at);

CREATE TRIGGER session_notes_set_updated_at
BEFORE UPDATE ON counseling.session_notes
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE counseling.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES counseling.appointments(id) ON DELETE CASCADE,
  roadmap_id uuid REFERENCES roadmap.roadmaps(id) ON DELETE SET NULL,
  milestone_id uuid REFERENCES roadmap.milestones(id) ON DELETE SET NULL,
  assignee_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  title text NOT NULL,
  due_on date,
  status text NOT NULL DEFAULT 'open',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_items_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT action_items_status_valid CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
  CONSTRAINT action_items_completion_consistent CHECK (
    (status = 'completed' AND completed_at IS NOT NULL)
    OR status <> 'completed'
  )
);

CREATE INDEX action_items_assignee_open_idx
  ON counseling.action_items(assignee_user_id, due_on)
  WHERE status IN ('open', 'in_progress');

CREATE TRIGGER action_items_set_updated_at
BEFORE UPDATE ON counseling.action_items
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE counseling.recommendation_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  relationship_id uuid NOT NULL REFERENCES counseling.relationships(id) ON DELETE CASCADE,
  career_option_id uuid NOT NULL REFERENCES recommendation.career_options(id) ON DELETE CASCADE,
  reviewer_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  review_outcome text NOT NULL,
  feedback_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT recommendation_reviews_outcome_valid CHECK (
    review_outcome IN ('support', 'needs_discussion', 'data_issue', 'explanation_issue', 'potential_bias')
  ),
  CONSTRAINT recommendation_reviews_feedback_not_blank CHECK (length(btrim(feedback_text)) > 0),
  UNIQUE (relationship_id, career_option_id, reviewer_user_id)
);

CREATE TABLE governance.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  actor_role text,
  subject_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  action_code text NOT NULL,
  resource_type text NOT NULL,
  resource_id text,
  purpose_code text,
  outcome text NOT NULL,
  request_id uuid,
  trace_id text,
  ip_hash bytea,
  user_agent_hash bytea,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT audit_events_action_format CHECK (action_code ~ '^[a-z][a-z0-9_.]{2,127}$'),
  CONSTRAINT audit_events_resource_format CHECK (resource_type ~ '^[a-z][a-z0-9_.]{1,127}$'),
  CONSTRAINT audit_events_outcome_valid CHECK (outcome IN ('success', 'denied', 'failed')),
  CONSTRAINT audit_events_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX audit_events_subject_time_idx
  ON governance.audit_events(subject_user_id, occurred_at DESC)
  WHERE subject_user_id IS NOT NULL;
CREATE INDEX audit_events_actor_time_idx
  ON governance.audit_events(actor_user_id, occurred_at DESC)
  WHERE actor_user_id IS NOT NULL;
CREATE INDEX audit_events_resource_idx
  ON governance.audit_events(resource_type, resource_id, occurred_at DESC);
CREATE INDEX audit_events_request_idx
  ON governance.audit_events(request_id)
  WHERE request_id IS NOT NULL;

CREATE TABLE governance.issue_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  issue_type text NOT NULL,
  severity text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  recommendation_run_id uuid REFERENCES recommendation.runs(id) ON DELETE SET NULL,
  career_option_id uuid REFERENCES recommendation.career_options(id) ON DELETE SET NULL,
  subject_type text,
  subject_id uuid,
  title text NOT NULL,
  description text NOT NULL,
  assigned_to_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  resolution_code text,
  resolution_text text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT issue_reports_type_valid CHECK (
    issue_type IN ('bias', 'privacy', 'taxonomy_error', 'outdated_data', 'weak_explanation', 'unsafe_content', 'data_quality', 'security')
  ),
  CONSTRAINT issue_reports_severity_valid CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT issue_reports_status_valid CHECK (
    status IN ('submitted', 'triaged', 'investigating', 'resolved', 'rejected', 'reopened')
  ),
  CONSTRAINT issue_reports_subject_present CHECK (
    recommendation_run_id IS NOT NULL OR career_option_id IS NOT NULL OR (subject_type IS NOT NULL AND subject_id IS NOT NULL)
  ),
  CONSTRAINT issue_reports_title_not_blank CHECK (length(btrim(title)) BETWEEN 1 AND 300),
  CONSTRAINT issue_reports_description_not_blank CHECK (length(btrim(description)) > 0),
  CONSTRAINT issue_reports_resolution_consistent CHECK (
    (status IN ('resolved', 'rejected') AND resolved_at IS NOT NULL AND resolution_code IS NOT NULL)
    OR status NOT IN ('resolved', 'rejected')
  )
);

CREATE INDEX issue_reports_work_queue_idx
  ON governance.issue_reports(severity DESC, created_at)
  WHERE status IN ('submitted', 'triaged', 'investigating', 'reopened');
CREATE INDEX issue_reports_option_idx
  ON governance.issue_reports(career_option_id)
  WHERE career_option_id IS NOT NULL;

CREATE TRIGGER issue_reports_set_updated_at
BEFORE UPDATE ON governance.issue_reports
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE governance.fairness_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_release_id uuid NOT NULL REFERENCES governance.model_releases(id) ON DELETE RESTRICT,
  taxonomy_release_id uuid NOT NULL REFERENCES taxonomy.releases(id) ON DELETE RESTRICT,
  test_suite_version text NOT NULL,
  scope_definition jsonb NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  approved_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fairness_test_runs_scope_object CHECK (jsonb_typeof(scope_definition) = 'object'),
  CONSTRAINT fairness_test_runs_status_valid CHECK (
    status IN ('queued', 'running', 'passed', 'failed', 'inconclusive', 'cancelled')
  ),
  CONSTRAINT fairness_test_runs_summary_object CHECK (jsonb_typeof(summary) = 'object'),
  CONSTRAINT fairness_test_runs_completion_consistent CHECK (
    (status IN ('passed', 'failed', 'inconclusive', 'cancelled') AND completed_at IS NOT NULL)
    OR status IN ('queued', 'running')
  ),
  CONSTRAINT fairness_test_runs_approval_consistent CHECK (
    approved_at IS NULL OR (status = 'passed' AND approved_by_user_id IS NOT NULL)
  )
);

CREATE INDEX fairness_test_runs_model_idx
  ON governance.fairness_test_runs(model_release_id, created_at DESC);

CREATE TABLE governance.fairness_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fairness_test_run_id uuid NOT NULL REFERENCES governance.fairness_test_runs(id) ON DELETE CASCADE,
  metric_code text NOT NULL,
  cohort_definition jsonb NOT NULL,
  comparison_cohort_definition jsonb,
  metric_value numeric(18,8) NOT NULL,
  threshold_min numeric(18,8),
  threshold_max numeric(18,8),
  sample_size integer NOT NULL,
  passed boolean,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fairness_metrics_code_format CHECK (metric_code ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  CONSTRAINT fairness_metrics_cohort_object CHECK (jsonb_typeof(cohort_definition) = 'object'),
  CONSTRAINT fairness_metrics_comparison_object CHECK (
    comparison_cohort_definition IS NULL OR jsonb_typeof(comparison_cohort_definition) = 'object'
  ),
  CONSTRAINT fairness_metrics_threshold_valid CHECK (
    threshold_min IS NULL OR threshold_max IS NULL OR threshold_max >= threshold_min
  ),
  CONSTRAINT fairness_metrics_sample_positive CHECK (sample_size > 0)
);

CREATE INDEX fairness_metrics_run_idx
  ON governance.fairness_metrics(fairness_test_run_id, metric_code);

CREATE TABLE governance.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type text NOT NULL,
  aggregate_id text NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  attempt_count integer NOT NULL DEFAULT 0,
  available_at timestamptz NOT NULL DEFAULT now(),
  locked_at timestamptz,
  processed_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT outbox_events_payload_object CHECK (jsonb_typeof(payload) = 'object'),
  CONSTRAINT outbox_events_status_valid CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  CONSTRAINT outbox_events_attempts_nonnegative CHECK (attempt_count >= 0),
  CONSTRAINT outbox_events_processed_consistent CHECK (
    (status = 'processed' AND processed_at IS NOT NULL)
    OR status <> 'processed'
  )
);

CREATE INDEX outbox_events_dispatch_idx
  ON governance.outbox_events(available_at, created_at)
  WHERE status IN ('pending', 'failed');

COMMENT ON TABLE recommendation.runs IS
  'Immutable recommendation execution context tied to profile, model, taxonomy and market cut-off.';
COMMENT ON COLUMN recommendation.career_options.retrieval_score IS
  'Internal retrieval/ranking aid. It must not be presented as a deterministic career-fit score.';
COMMENT ON TABLE roadmap.roadmap_versions IS
  'Versioned plan content; progress is captured separately as append-only events.';
COMMENT ON TABLE governance.audit_events IS
  'Append-only access and change ledger. Do not store passwords, tokens, raw prompts or full PII in metadata.';

COMMIT;
