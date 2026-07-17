BEGIN;

-- Run this file with a DBA/migration account that has CREATEROLE.
-- LOGIN roles should inherit exactly one of these NOLOGIN group roles.

DO $block$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meshmind_app') THEN
    CREATE ROLE meshmind_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meshmind_market_worker') THEN
    CREATE ROLE meshmind_market_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meshmind_recommendation_worker') THEN
    CREATE ROLE meshmind_recommendation_worker NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meshmind_auditor') THEN
    CREATE ROLE meshmind_auditor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'meshmind_readonly') THEN
    CREATE ROLE meshmind_readonly NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS;
  END IF;
END;
$block$;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE ALL ON SCHEMA catalog, iam, privacy, taxonomy, profile, market, learning,
  governance, recommendation, roadmap, counseling FROM PUBLIC;

GRANT USAGE ON SCHEMA catalog, iam, privacy, taxonomy, profile, market, learning,
  governance, recommendation, roadmap, counseling
TO meshmind_app, meshmind_market_worker, meshmind_recommendation_worker, meshmind_auditor, meshmind_readonly;

GRANT USAGE ON TYPE catalog.score_01, catalog.proficiency_0_5, catalog.currency_code
TO meshmind_app, meshmind_market_worker, meshmind_recommendation_worker,
  meshmind_auditor, meshmind_readonly;

CREATE OR REPLACE FUNCTION iam.current_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $function$
  SELECT nullif(current_setting('app.current_user_id', true), '')::uuid
$function$;

CREATE OR REPLACE FUNCTION iam.has_active_role(requested_role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, iam
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM iam.user_roles ur
    WHERE ur.user_id = iam.current_user_id()
      AND ur.role_code = requested_role
      AND ur.revoked_at IS NULL
      AND (ur.expires_at IS NULL OR ur.expires_at > now())
  )
$function$;

CREATE OR REPLACE FUNCTION privacy.has_active_share(
  owner_id uuid,
  requested_scope text,
  requested_access text DEFAULT 'read'
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, privacy, iam
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM privacy.share_grants sg
    JOIN privacy.share_grant_scopes sgs ON sgs.share_grant_id = sg.id
    WHERE sg.owner_user_id = owner_id
      AND sg.recipient_user_id = iam.current_user_id()
      AND sg.status = 'active'
      AND now() >= sg.valid_from
      AND now() < sg.valid_until
      AND sg.revoked_at IS NULL
      AND sgs.scope_code = requested_scope
      AND CASE requested_access
        WHEN 'read' THEN sgs.access_level IN ('read', 'comment', 'edit')
        WHEN 'comment' THEN sgs.access_level IN ('comment', 'edit')
        WHEN 'edit' THEN sgs.access_level = 'edit'
        ELSE false
      END
  )
$function$;

REVOKE ALL ON FUNCTION iam.current_user_id() FROM PUBLIC;
REVOKE ALL ON FUNCTION iam.has_active_role(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION privacy.has_active_share(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION iam.current_user_id()
  TO meshmind_app, meshmind_recommendation_worker, meshmind_auditor;
GRANT EXECUTE ON FUNCTION iam.has_active_role(text)
  TO meshmind_app, meshmind_auditor;
GRANT EXECUTE ON FUNCTION privacy.has_active_share(uuid, text, text)
  TO meshmind_app;

-- Reference and published content.
GRANT SELECT ON catalog.locations, catalog.organizations, catalog.data_sources,
  taxonomy.releases, taxonomy.skills, taxonomy.skill_aliases, taxonomy.skill_relations,
  taxonomy.occupations, taxonomy.occupation_aliases, taxonomy.occupation_tasks,
  taxonomy.occupation_skills, taxonomy.occupation_relations,
  market.job_postings, market.job_posting_versions, market.job_occupation_mappings,
  market.job_skill_mentions, market.labor_market_signals, market.signal_source_stats,
  learning.opportunities, learning.opportunity_versions, learning.opportunity_skills,
  learning.opportunity_occupations
TO meshmind_app;

GRANT SELECT ON ALL TABLES IN SCHEMA catalog, taxonomy, market, learning
TO meshmind_readonly;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA catalog, taxonomy, market, learning
TO meshmind_market_worker;
GRANT DELETE ON market.raw_records TO meshmind_market_worker;
GRANT SELECT, INSERT, UPDATE ON governance.model_releases, governance.data_quality_results,
  governance.outbox_events
TO meshmind_market_worker;

-- IAM permissions are further constrained by RLS and API-level field allowlists.
GRANT SELECT, UPDATE (full_name, locale, time_zone, last_login_at) ON iam.users TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON iam.user_emails TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON iam.password_credentials TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON iam.auth_sessions TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON iam.one_time_tokens TO meshmind_app;
GRANT SELECT ON iam.roles, iam.user_roles TO meshmind_app;

-- Privacy and profile permissions.
GRANT SELECT ON privacy.consent_purposes, privacy.policy_versions TO meshmind_app;
GRANT SELECT, INSERT ON privacy.consent_records TO meshmind_app;
GRANT SELECT, INSERT ON privacy.share_grants TO meshmind_app;
GRANT UPDATE (status, valid_until, revoked_at, revoke_reason)
  ON privacy.share_grants TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON privacy.share_grant_scopes TO meshmind_app;
GRANT SELECT, INSERT, UPDATE ON privacy.guardian_relationships TO meshmind_app;
GRANT SELECT, INSERT ON privacy.data_subject_requests TO meshmind_app;
GRANT SELECT, INSERT ON privacy.fairness_attribute_responses TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA profile TO meshmind_app;
REVOKE INSERT, UPDATE, DELETE ON profile.skill_summaries FROM meshmind_app;

-- Recommendation worker can read only ranking inputs, never voluntary fairness attributes.
GRANT SELECT ON iam.users, profile.learner_profiles, profile.learner_goals,
  profile.preference_dimensions, profile.learner_preferences,
  profile.learner_location_preferences, profile.education_records,
  profile.academic_results, profile.evidence_items, profile.skill_observations,
  profile.skill_summaries, profile.profile_snapshots,
  privacy.consent_records, privacy.consent_purposes,
  taxonomy.releases, taxonomy.skills, taxonomy.skill_relations,
  taxonomy.occupations, taxonomy.occupation_tasks, taxonomy.occupation_skills,
  taxonomy.occupation_relations, market.labor_market_signals, market.signal_source_stats,
  learning.opportunities, learning.opportunity_versions, learning.opportunity_skills,
  learning.opportunity_occupations, governance.model_releases
TO meshmind_recommendation_worker;
GRANT INSERT, UPDATE ON profile.skill_summaries TO meshmind_recommendation_worker;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA recommendation
TO meshmind_recommendation_worker;
REVOKE INSERT, UPDATE, DELETE ON recommendation.option_feedback
FROM meshmind_recommendation_worker;
GRANT SELECT, INSERT, UPDATE ON governance.outbox_events
TO meshmind_recommendation_worker;

GRANT SELECT ON ALL TABLES IN SCHEMA recommendation TO meshmind_app;
GRANT INSERT, UPDATE ON recommendation.option_feedback TO meshmind_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA roadmap, counseling
TO meshmind_app;
GRANT SELECT, INSERT ON governance.audit_events TO meshmind_app;
GRANT SELECT, INSERT, UPDATE ON governance.issue_reports TO meshmind_app;

GRANT SELECT ON governance.audit_events, governance.issue_reports,
  governance.fairness_test_runs, governance.fairness_metrics,
  governance.data_quality_results, governance.model_releases
TO meshmind_auditor;
GRANT INSERT, UPDATE ON governance.issue_reports, governance.fairness_test_runs,
  governance.fairness_metrics
TO meshmind_auditor;
GRANT SELECT, UPDATE ON privacy.data_subject_requests TO meshmind_auditor;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA market, governance
TO meshmind_market_worker, meshmind_recommendation_worker, meshmind_app, meshmind_auditor;

-- IAM row security.
ALTER TABLE iam.users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_select ON iam.users
  FOR SELECT TO meshmind_app
  USING (id = iam.current_user_id());
CREATE POLICY users_self_update ON iam.users
  FOR UPDATE TO meshmind_app
  USING (id = iam.current_user_id())
  WITH CHECK (id = iam.current_user_id());

ALTER TABLE iam.user_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_emails_self_all ON iam.user_emails
  FOR ALL TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

ALTER TABLE iam.password_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY password_credentials_self_all ON iam.password_credentials
  FOR ALL TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

ALTER TABLE iam.auth_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_sessions_self_all ON iam.auth_sessions
  FOR ALL TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

ALTER TABLE iam.one_time_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY one_time_tokens_self_all ON iam.one_time_tokens
  FOR ALL TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

ALTER TABLE iam.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_roles_self_select ON iam.user_roles
  FOR SELECT TO meshmind_app
  USING (user_id = iam.current_user_id());

-- Privacy row security.
ALTER TABLE privacy.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY consent_records_self_select ON privacy.consent_records
  FOR SELECT TO meshmind_app
  USING (user_id = iam.current_user_id());
CREATE POLICY consent_records_self_insert ON privacy.consent_records
  FOR INSERT TO meshmind_app
  WITH CHECK (
    user_id = iam.current_user_id()
    AND actor_user_id = iam.current_user_id()
    AND actor_relationship = 'self'
  );
CREATE POLICY consent_records_worker_select ON privacy.consent_records
  FOR SELECT TO meshmind_recommendation_worker
  USING (purpose_code = 'profile.personalization');

ALTER TABLE privacy.share_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_grants_participant_select ON privacy.share_grants
  FOR SELECT TO meshmind_app
  USING (owner_user_id = iam.current_user_id() OR recipient_user_id = iam.current_user_id());
CREATE POLICY share_grants_owner_insert ON privacy.share_grants
  FOR INSERT TO meshmind_app
  WITH CHECK (owner_user_id = iam.current_user_id());
CREATE POLICY share_grants_owner_update ON privacy.share_grants
  FOR UPDATE TO meshmind_app
  USING (owner_user_id = iam.current_user_id())
  WITH CHECK (owner_user_id = iam.current_user_id());

ALTER TABLE privacy.share_grant_scopes ENABLE ROW LEVEL SECURITY;
CREATE POLICY share_grant_scopes_participant_select ON privacy.share_grant_scopes
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM privacy.share_grants sg
      WHERE sg.id = share_grant_id
        AND (sg.owner_user_id = iam.current_user_id() OR sg.recipient_user_id = iam.current_user_id())
    )
  );
CREATE POLICY share_grant_scopes_owner_write ON privacy.share_grant_scopes
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM privacy.share_grants sg
      WHERE sg.id = share_grant_id AND sg.owner_user_id = iam.current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM privacy.share_grants sg
      WHERE sg.id = share_grant_id AND sg.owner_user_id = iam.current_user_id()
    )
  );

ALTER TABLE privacy.guardian_relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY guardian_relationships_participant_all ON privacy.guardian_relationships
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id() OR guardian_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id() OR guardian_user_id = iam.current_user_id());

ALTER TABLE privacy.data_subject_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY data_subject_requests_self_select ON privacy.data_subject_requests
  FOR SELECT TO meshmind_app
  USING (user_id = iam.current_user_id());
CREATE POLICY data_subject_requests_self_insert ON privacy.data_subject_requests
  FOR INSERT TO meshmind_app
  WITH CHECK (user_id = iam.current_user_id());
CREATE POLICY data_subject_requests_auditor_all ON privacy.data_subject_requests
  FOR ALL TO meshmind_auditor
  USING (true)
  WITH CHECK (true);

ALTER TABLE privacy.fairness_attribute_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY fairness_attributes_self_all ON privacy.fairness_attribute_responses
  FOR ALL TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());

-- Profile row security. A worker policy is explicit and does not apply to privacy fairness data.
ALTER TABLE profile.learner_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_profiles_owner_or_shared_select ON profile.learner_profiles
  FOR SELECT TO meshmind_app
  USING (
    user_id = iam.current_user_id()
    OR privacy.has_active_share(user_id, 'profile.summary', 'read')
  );
CREATE POLICY learner_profiles_owner_write ON profile.learner_profiles
  FOR ALL TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());
CREATE POLICY learner_profiles_worker_select ON profile.learner_profiles
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.learner_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_goals_owner_or_shared_select ON profile.learner_goals
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.summary', 'read')
  );
CREATE POLICY learner_goals_owner_write ON profile.learner_goals
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY learner_goals_worker_select ON profile.learner_goals
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.learner_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_preferences_owner_or_shared_select ON profile.learner_preferences
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.summary', 'read')
  );
CREATE POLICY learner_preferences_owner_write ON profile.learner_preferences
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY learner_preferences_worker_select ON profile.learner_preferences
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.learner_location_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY learner_location_preferences_owner_or_shared_select ON profile.learner_location_preferences
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.summary', 'read')
  );
CREATE POLICY learner_location_preferences_owner_write ON profile.learner_location_preferences
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY learner_location_preferences_worker_select ON profile.learner_location_preferences
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.education_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY education_records_owner_or_shared_select ON profile.education_records
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.education', 'read')
  );
CREATE POLICY education_records_owner_write ON profile.education_records
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY education_records_worker_select ON profile.education_records
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.academic_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY academic_results_owner_or_shared_select ON profile.academic_results
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM profile.education_records er
      WHERE er.id = education_record_id
        AND (
          er.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(er.learner_user_id, 'profile.education', 'read')
        )
    )
  );
CREATE POLICY academic_results_owner_write ON profile.academic_results
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM profile.education_records er
      WHERE er.id = education_record_id AND er.learner_user_id = iam.current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile.education_records er
      WHERE er.id = education_record_id AND er.learner_user_id = iam.current_user_id()
    )
  );
CREATE POLICY academic_results_worker_select ON profile.academic_results
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.evidence_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_items_owner_or_shared_select ON profile.evidence_items
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.evidence', 'read')
  );
CREATE POLICY evidence_items_owner_write ON profile.evidence_items
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY evidence_items_worker_select ON profile.evidence_items
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.evidence_assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_assets_owner_or_shared_select ON profile.evidence_assets
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM profile.evidence_items ei
      WHERE ei.id = evidence_item_id
        AND (
          ei.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(ei.learner_user_id, 'profile.evidence', 'read')
        )
    )
  );
CREATE POLICY evidence_assets_owner_write ON profile.evidence_assets
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM profile.evidence_items ei
      WHERE ei.id = evidence_item_id AND ei.learner_user_id = iam.current_user_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile.evidence_items ei
      WHERE ei.id = evidence_item_id AND ei.learner_user_id = iam.current_user_id()
    )
  );

ALTER TABLE profile.skill_observations ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_observations_owner_or_shared_select ON profile.skill_observations
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.skills', 'read')
  );
CREATE POLICY skill_observations_owner_write ON profile.skill_observations
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY skill_observations_worker_select ON profile.skill_observations
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

ALTER TABLE profile.skill_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY skill_summaries_owner_or_shared_select ON profile.skill_summaries
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'profile.skills', 'read')
  );
CREATE POLICY skill_summaries_worker_all ON profile.skill_summaries
  FOR ALL TO meshmind_recommendation_worker
  USING (true)
  WITH CHECK (true);

ALTER TABLE profile.profile_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY profile_snapshots_owner_select ON profile.profile_snapshots
  FOR SELECT TO meshmind_app
  USING (learner_user_id = iam.current_user_id());
CREATE POLICY profile_snapshots_owner_write ON profile.profile_snapshots
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY profile_snapshots_worker_select ON profile.profile_snapshots
  FOR SELECT TO meshmind_recommendation_worker
  USING (true);

-- Recommendation row security.
ALTER TABLE recommendation.runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY recommendation_runs_owner_or_shared_select ON recommendation.runs
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'recommendations', 'read')
  );
CREATE POLICY recommendation_runs_worker_all ON recommendation.runs
  FOR ALL TO meshmind_recommendation_worker
  USING (true)
  WITH CHECK (true);

ALTER TABLE recommendation.career_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY career_options_owner_or_shared_select ON recommendation.career_options
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM recommendation.runs rr
      WHERE rr.id = recommendation_run_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY career_options_worker_all ON recommendation.career_options
  FOR ALL TO meshmind_recommendation_worker
  USING (true)
  WITH CHECK (true);

ALTER TABLE recommendation.option_dimensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_dimensions_owner_or_shared_select ON recommendation.option_dimensions
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY option_dimensions_worker_all ON recommendation.option_dimensions
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

ALTER TABLE recommendation.option_reasons ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_reasons_owner_or_shared_select ON recommendation.option_reasons
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY option_reasons_worker_all ON recommendation.option_reasons
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

ALTER TABLE recommendation.option_evidence_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_evidence_links_owner_or_shared_select ON recommendation.option_evidence_links
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY option_evidence_links_worker_all ON recommendation.option_evidence_links
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

ALTER TABLE recommendation.option_market_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_market_links_owner_or_shared_select ON recommendation.option_market_links
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY option_market_links_worker_all ON recommendation.option_market_links
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

ALTER TABLE recommendation.option_skill_gaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_skill_gaps_owner_or_shared_select ON recommendation.option_skill_gaps
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY option_skill_gaps_worker_all ON recommendation.option_skill_gaps
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

ALTER TABLE recommendation.option_learning_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_learning_links_owner_or_shared_select ON recommendation.option_learning_links
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id
        AND (
          rr.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(rr.learner_user_id, 'recommendations', 'read')
        )
    )
  );
CREATE POLICY option_learning_links_worker_all ON recommendation.option_learning_links
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

ALTER TABLE recommendation.option_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY option_feedback_owner_select ON recommendation.option_feedback
  FOR SELECT TO meshmind_app
  USING (user_id = iam.current_user_id());
CREATE POLICY option_feedback_owner_insert ON recommendation.option_feedback
  FOR INSERT TO meshmind_app
  WITH CHECK (
    user_id = iam.current_user_id()
    AND EXISTS (
      SELECT 1
      FROM recommendation.career_options co
      JOIN recommendation.runs rr ON rr.id = co.recommendation_run_id
      WHERE co.id = career_option_id AND rr.learner_user_id = iam.current_user_id()
    )
  );
CREATE POLICY option_feedback_owner_update ON recommendation.option_feedback
  FOR UPDATE TO meshmind_app
  USING (user_id = iam.current_user_id())
  WITH CHECK (user_id = iam.current_user_id());
CREATE POLICY option_feedback_worker_all ON recommendation.option_feedback
  FOR ALL TO meshmind_recommendation_worker USING (true) WITH CHECK (true);

-- Roadmap helper expressions use the roadmap owner as the security boundary.
ALTER TABLE roadmap.roadmaps ENABLE ROW LEVEL SECURITY;
CREATE POLICY roadmaps_owner_or_shared_select ON roadmap.roadmaps
  FOR SELECT TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'roadmaps', 'read')
    OR privacy.has_active_share(learner_user_id, 'roadmaps.edit', 'read')
  );
CREATE POLICY roadmaps_owner_insert ON roadmap.roadmaps
  FOR INSERT TO meshmind_app
  WITH CHECK (learner_user_id = iam.current_user_id());
CREATE POLICY roadmaps_owner_or_editor_update ON roadmap.roadmaps
  FOR UPDATE TO meshmind_app
  USING (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'roadmaps.edit', 'edit')
  )
  WITH CHECK (
    learner_user_id = iam.current_user_id()
    OR privacy.has_active_share(learner_user_id, 'roadmaps.edit', 'edit')
  );
CREATE POLICY roadmaps_owner_delete ON roadmap.roadmaps
  FOR DELETE TO meshmind_app
  USING (learner_user_id = iam.current_user_id());

ALTER TABLE roadmap.roadmap_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY roadmap_versions_owner_or_shared_select ON roadmap.roadmap_versions
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM roadmap.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY roadmap_versions_owner_or_editor_write ON roadmap.roadmap_versions
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM roadmap.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roadmap.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

ALTER TABLE roadmap.milestones ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestones_owner_or_shared_select ON roadmap.milestones
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.roadmap_versions rv
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE rv.id = roadmap_version_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY milestones_owner_or_editor_write ON roadmap.milestones
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.roadmap_versions rv
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE rv.id = roadmap_version_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM roadmap.roadmap_versions rv
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE rv.id = roadmap_version_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

ALTER TABLE roadmap.milestone_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_dependencies_visible ON roadmap.milestone_dependencies
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY milestone_dependencies_editable ON roadmap.milestone_dependencies
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

ALTER TABLE roadmap.milestone_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_skills_visible ON roadmap.milestone_skills
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY milestone_skills_editable ON roadmap.milestone_skills
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

ALTER TABLE roadmap.milestone_evidence_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_evidence_requirements_visible ON roadmap.milestone_evidence_requirements
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY milestone_evidence_requirements_editable ON roadmap.milestone_evidence_requirements
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

ALTER TABLE roadmap.progress_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY progress_events_owner_or_shared_select ON roadmap.progress_events
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM roadmap.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY progress_events_owner_or_editor_insert ON roadmap.progress_events
  FOR INSERT TO meshmind_app
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM roadmap.roadmaps r
      WHERE r.id = roadmap_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

ALTER TABLE roadmap.milestone_evidence_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY milestone_evidence_links_visible ON roadmap.milestone_evidence_links
  FOR SELECT TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps', 'read')
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'read')
        )
    )
  );
CREATE POLICY milestone_evidence_links_editable ON roadmap.milestone_evidence_links
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM roadmap.milestones m
      JOIN roadmap.roadmap_versions rv ON rv.id = m.roadmap_version_id
      JOIN roadmap.roadmaps r ON r.id = rv.roadmap_id
      WHERE m.id = milestone_id
        AND (
          r.learner_user_id = iam.current_user_id()
          OR privacy.has_active_share(r.learner_user_id, 'roadmaps.edit', 'edit')
        )
    )
  );

-- Counseling row security.
ALTER TABLE counseling.relationships ENABLE ROW LEVEL SECURITY;
CREATE POLICY counseling_relationships_participant_all ON counseling.relationships
  FOR ALL TO meshmind_app
  USING (learner_user_id = iam.current_user_id() OR counselor_user_id = iam.current_user_id())
  WITH CHECK (learner_user_id = iam.current_user_id() OR counselor_user_id = iam.current_user_id());

ALTER TABLE counseling.appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY appointments_participant_all ON counseling.appointments
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM counseling.relationships cr
      WHERE cr.id = relationship_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM counseling.relationships cr
      WHERE cr.id = relationship_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  );

ALTER TABLE counseling.session_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY session_notes_participant_select ON counseling.session_notes
  FOR SELECT TO meshmind_app
  USING (
    author_user_id = iam.current_user_id()
    OR EXISTS (
      SELECT 1
      FROM counseling.appointments ca
      JOIN counseling.relationships cr ON cr.id = ca.relationship_id
      WHERE ca.id = appointment_id
        AND (
          (cr.learner_user_id = iam.current_user_id() AND visibility IN ('shared_with_learner', 'learner_only'))
          OR (cr.counselor_user_id = iam.current_user_id() AND visibility IN ('shared_with_learner', 'counselor_only'))
        )
    )
  );
CREATE POLICY session_notes_author_insert ON counseling.session_notes
  FOR INSERT TO meshmind_app
  WITH CHECK (
    author_user_id = iam.current_user_id()
    AND EXISTS (
      SELECT 1
      FROM counseling.appointments ca
      JOIN counseling.relationships cr ON cr.id = ca.relationship_id
      WHERE ca.id = appointment_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  );
CREATE POLICY session_notes_author_update ON counseling.session_notes
  FOR UPDATE TO meshmind_app
  USING (author_user_id = iam.current_user_id())
  WITH CHECK (author_user_id = iam.current_user_id());

ALTER TABLE counseling.action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY action_items_participant_all ON counseling.action_items
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1
      FROM counseling.appointments ca
      JOIN counseling.relationships cr ON cr.id = ca.relationship_id
      WHERE ca.id = appointment_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM counseling.appointments ca
      JOIN counseling.relationships cr ON cr.id = ca.relationship_id
      WHERE ca.id = appointment_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  );

ALTER TABLE counseling.recommendation_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY recommendation_reviews_participant_all ON counseling.recommendation_reviews
  FOR ALL TO meshmind_app
  USING (
    EXISTS (
      SELECT 1 FROM counseling.relationships cr
      WHERE cr.id = relationship_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  )
  WITH CHECK (
    reviewer_user_id = iam.current_user_id()
    AND EXISTS (
      SELECT 1 FROM counseling.relationships cr
      WHERE cr.id = relationship_id
        AND (cr.learner_user_id = iam.current_user_id() OR cr.counselor_user_id = iam.current_user_id())
    )
  );

-- Governance security.
ALTER TABLE governance.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_events_subject_select ON governance.audit_events
  FOR SELECT TO meshmind_app
  USING (subject_user_id = iam.current_user_id());
CREATE POLICY audit_events_app_insert ON governance.audit_events
  FOR INSERT TO meshmind_app
  WITH CHECK (actor_user_id IS NULL OR actor_user_id = iam.current_user_id());
CREATE POLICY audit_events_auditor_select ON governance.audit_events
  FOR SELECT TO meshmind_auditor
  USING (true);

ALTER TABLE governance.issue_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY issue_reports_reporter_select ON governance.issue_reports
  FOR SELECT TO meshmind_app
  USING (reporter_user_id = iam.current_user_id() OR iam.has_active_role('ethics_auditor'));
CREATE POLICY issue_reports_reporter_insert ON governance.issue_reports
  FOR INSERT TO meshmind_app
  WITH CHECK (reporter_user_id = iam.current_user_id());
CREATE POLICY issue_reports_reporter_update ON governance.issue_reports
  FOR UPDATE TO meshmind_app
  USING (reporter_user_id = iam.current_user_id() OR iam.has_active_role('ethics_auditor'))
  WITH CHECK (reporter_user_id = iam.current_user_id() OR iam.has_active_role('ethics_auditor'));
CREATE POLICY issue_reports_auditor_all ON governance.issue_reports
  FOR ALL TO meshmind_auditor
  USING (true)
  WITH CHECK (true);

ALTER TABLE governance.fairness_test_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY fairness_test_runs_auditor_all ON governance.fairness_test_runs
  FOR ALL TO meshmind_auditor
  USING (true)
  WITH CHECK (true);

ALTER TABLE governance.fairness_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY fairness_metrics_auditor_all ON governance.fairness_metrics
  FOR ALL TO meshmind_auditor
  USING (true)
  WITH CHECK (true);

-- Append-only records: ordinary roles cannot mutate or delete them.
REVOKE UPDATE, DELETE ON privacy.consent_records FROM meshmind_app;
REVOKE UPDATE, DELETE ON governance.audit_events FROM meshmind_app, meshmind_auditor,
  meshmind_market_worker, meshmind_recommendation_worker;
REVOKE ALL ON privacy.fairness_attribute_responses FROM meshmind_market_worker,
  meshmind_recommendation_worker, meshmind_readonly, meshmind_auditor;

ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

COMMIT;
