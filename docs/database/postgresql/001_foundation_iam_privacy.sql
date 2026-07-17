BEGIN;

-- MeshMind target-state schema for PostgreSQL 18.
-- This is a greenfield reference migration. Read the migration/runbook document
-- before applying it to a database that already contains public.users.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA catalog;
CREATE SCHEMA iam;
CREATE SCHEMA privacy;
CREATE SCHEMA taxonomy;
CREATE SCHEMA profile;
CREATE SCHEMA market;
CREATE SCHEMA learning;
CREATE SCHEMA governance;
CREATE SCHEMA recommendation;
CREATE SCHEMA roadmap;
CREATE SCHEMA counseling;

CREATE DOMAIN catalog.score_01 AS numeric(5,4)
  CHECK (VALUE >= 0 AND VALUE <= 1);

CREATE DOMAIN catalog.proficiency_0_5 AS smallint
  CHECK (VALUE >= 0 AND VALUE <= 5);

CREATE DOMAIN catalog.currency_code AS varchar(3)
  CHECK (VALUE ~ '^[A-Z]{3}$');

CREATE OR REPLACE FUNCTION catalog.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$function$;

CREATE TABLE catalog.locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES catalog.locations(id) ON DELETE RESTRICT,
  country_code char(2) NOT NULL,
  admin_level smallint NOT NULL DEFAULT 0,
  code text,
  name_vi text NOT NULL,
  name_en text,
  time_zone text,
  latitude numeric(9,6),
  longitude numeric(9,6),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT locations_country_code_format CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT locations_admin_level_nonnegative CHECK (admin_level >= 0),
  CONSTRAINT locations_latitude_valid CHECK (latitude IS NULL OR latitude BETWEEN -90 AND 90),
  CONSTRAINT locations_longitude_valid CHECK (longitude IS NULL OR longitude BETWEEN -180 AND 180),
  CONSTRAINT locations_not_self_parent CHECK (parent_id IS NULL OR parent_id <> id),
  UNIQUE (country_code, code)
);

CREATE INDEX locations_parent_idx ON catalog.locations(parent_id);
CREATE INDEX locations_name_vi_trgm_idx ON catalog.locations USING gin (name_vi gin_trgm_ops);

CREATE TRIGGER locations_set_updated_at
BEFORE UPDATE ON catalog.locations
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE catalog.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_type text NOT NULL,
  name text NOT NULL,
  normalized_name text GENERATED ALWAYS AS (lower(btrim(name))) STORED,
  registration_code text,
  website_url text,
  description text,
  headquarters_location_id uuid REFERENCES catalog.locations(id) ON DELETE SET NULL,
  verification_status text NOT NULL DEFAULT 'unverified',
  verified_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT organizations_type_valid CHECK (
    organization_type IN ('employer', 'education_provider', 'certification_body', 'data_partner', 'government', 'nonprofit', 'other')
  ),
  CONSTRAINT organizations_name_not_blank CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  CONSTRAINT organizations_verification_status_valid CHECK (
    verification_status IN ('unverified', 'pending', 'verified', 'rejected')
  ),
  CONSTRAINT organizations_verified_time_consistent CHECK (
    (verification_status = 'verified' AND verified_at IS NOT NULL)
    OR (verification_status <> 'verified')
  ),
  CONSTRAINT organizations_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX organizations_normalized_name_trgm_idx
  ON catalog.organizations USING gin (normalized_name gin_trgm_ops);
CREATE INDEX organizations_type_active_idx
  ON catalog.organizations(organization_type, is_active);

CREATE TRIGGER organizations_set_updated_at
BEFORE UPDATE ON catalog.organizations
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE catalog.data_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_organization_id uuid REFERENCES catalog.organizations(id) ON DELETE SET NULL,
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  source_type text NOT NULL,
  access_method text NOT NULL,
  base_url text,
  license_name text,
  terms_url text,
  permitted_purposes text[] NOT NULL DEFAULT ARRAY[]::text[],
  retention_days integer,
  refresh_interval_minutes integer,
  status text NOT NULL DEFAULT 'active',
  last_legal_review_at timestamptz,
  last_successful_sync_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_sources_code_format CHECK (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT data_sources_type_valid CHECK (
    source_type IN ('job_posting', 'learning_opportunity', 'taxonomy', 'labor_supply', 'salary', 'internal')
  ),
  CONSTRAINT data_sources_access_method_valid CHECK (
    access_method IN ('api', 'feed', 'file', 'manual', 'open_data', 'internal')
  ),
  CONSTRAINT data_sources_status_valid CHECK (status IN ('active', 'paused', 'revoked', 'retired')),
  CONSTRAINT data_sources_retention_positive CHECK (retention_days IS NULL OR retention_days > 0),
  CONSTRAINT data_sources_refresh_positive CHECK (
    refresh_interval_minutes IS NULL OR refresh_interval_minutes > 0
  ),
  CONSTRAINT data_sources_metadata_object CHECK (jsonb_typeof(metadata) = 'object')
);

CREATE INDEX data_sources_type_status_idx ON catalog.data_sources(source_type, status);

CREATE TRIGGER data_sources_set_updated_at
BEFORE UPDATE ON catalog.data_sources
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE iam.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending_verification',
  locale varchar(10) NOT NULL DEFAULT 'vi-VN',
  time_zone text NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  last_login_at timestamptz,
  deactivated_at timestamptz,
  deletion_scheduled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT users_name_not_blank CHECK (length(btrim(full_name)) BETWEEN 1 AND 200),
  CONSTRAINT users_status_valid CHECK (
    status IN ('pending_verification', 'active', 'locked', 'deactivated', 'deletion_pending')
  ),
  CONSTRAINT users_deactivated_time_consistent CHECK (
    deactivated_at IS NULL OR status IN ('deactivated', 'deletion_pending')
  ),
  CONSTRAINT users_deletion_time_consistent CHECK (
    deletion_scheduled_at IS NULL OR status = 'deletion_pending'
  )
);

CREATE INDEX users_status_idx ON iam.users(status);

CREATE TRIGGER users_set_updated_at
BEFORE UPDATE ON iam.users
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE iam.user_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  email_normalized text GENERATED ALWAYS AS (lower(btrim(email))) STORED,
  is_primary boolean NOT NULL DEFAULT false,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_emails_shape CHECK (
    length(email) BETWEEN 3 AND 320
    AND position('@' IN email) > 1
  ),
  UNIQUE (email_normalized)
);

CREATE UNIQUE INDEX user_emails_one_primary_per_user_idx
  ON iam.user_emails(user_id)
  WHERE is_primary;
CREATE INDEX user_emails_user_idx ON iam.user_emails(user_id);

CREATE TRIGGER user_emails_set_updated_at
BEFORE UPDATE ON iam.user_emails
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE iam.password_credentials (
  user_id uuid PRIMARY KEY REFERENCES iam.users(id) ON DELETE CASCADE,
  password_hash text NOT NULL,
  hashing_algorithm text NOT NULL DEFAULT 'argon2id',
  password_changed_at timestamptz NOT NULL DEFAULT now(),
  failed_attempt_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  requires_password_change boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT password_credentials_hash_not_blank CHECK (length(password_hash) >= 20),
  CONSTRAINT password_credentials_attempts_nonnegative CHECK (failed_attempt_count >= 0)
);

CREATE TRIGGER password_credentials_set_updated_at
BEFORE UPDATE ON iam.password_credentials
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE iam.auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  token_hash bytea NOT NULL UNIQUE,
  ip_hash bytea,
  user_agent_hash bytea,
  expires_at timestamptz NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_sessions_expiry_valid CHECK (expires_at > created_at),
  CONSTRAINT auth_sessions_revoke_consistent CHECK (
    (revoked_at IS NULL AND revoke_reason IS NULL)
    OR revoked_at IS NOT NULL
  )
);

CREATE INDEX auth_sessions_user_active_idx
  ON iam.auth_sessions(user_id, expires_at)
  WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expiry_idx ON iam.auth_sessions(expires_at);

CREATE TABLE iam.one_time_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES iam.users(id) ON DELETE CASCADE,
  email_id uuid REFERENCES iam.user_emails(id) ON DELETE CASCADE,
  purpose text NOT NULL,
  token_hash bytea NOT NULL UNIQUE,
  attempt_count integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT one_time_tokens_purpose_valid CHECK (
    purpose IN ('verify_email', 'reset_password', 'change_email', 'invite_counselor', 'invite_guardian')
  ),
  CONSTRAINT one_time_tokens_subject_present CHECK (user_id IS NOT NULL OR email_id IS NOT NULL),
  CONSTRAINT one_time_tokens_attempts_nonnegative CHECK (attempt_count >= 0),
  CONSTRAINT one_time_tokens_expiry_valid CHECK (expires_at > created_at),
  CONSTRAINT one_time_tokens_consumed_valid CHECK (consumed_at IS NULL OR consumed_at >= created_at)
);

CREATE INDEX one_time_tokens_user_purpose_idx
  ON iam.one_time_tokens(user_id, purpose, expires_at)
  WHERE consumed_at IS NULL;
CREATE INDEX one_time_tokens_expiry_idx ON iam.one_time_tokens(expires_at);

CREATE TABLE iam.roles (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  is_system_role boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT roles_code_format CHECK (code ~ '^[a-z][a-z0-9_]{1,63}$')
);

INSERT INTO iam.roles (code, name, description) VALUES
  ('learner', 'Người học', 'Quản lý hồ sơ và quyết định lộ trình của chính mình.'),
  ('counselor', 'Chuyên viên hướng nghiệp', 'Xem dữ liệu được chia sẻ và đồng biên tập roadmap.'),
  ('market_data_steward', 'Chuyên viên dữ liệu thị trường', 'Quản lý nguồn, pipeline và taxonomy thị trường lao động.'),
  ('content_steward', 'Quản trị nội dung', 'Quản lý cơ hội học tập và nội dung lộ trình.'),
  ('ethics_auditor', 'Phụ trách đạo đức', 'Kiểm toán fairness, quyền riêng tư và khiếu nại.'),
  ('system_admin', 'Quản trị hệ thống', 'Vận hành kỹ thuật theo nguyên tắc quyền tối thiểu.'),
  ('service_worker', 'Tài khoản dịch vụ', 'Thực thi job nền không có phiên người dùng.');

CREATE TABLE iam.user_roles (
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  role_code text NOT NULL REFERENCES iam.roles(code) ON DELETE RESTRICT,
  granted_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  revoked_at timestamptz,
  PRIMARY KEY (user_id, role_code, granted_at),
  CONSTRAINT user_roles_expiry_valid CHECK (expires_at IS NULL OR expires_at > granted_at),
  CONSTRAINT user_roles_revoke_valid CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE UNIQUE INDEX user_roles_one_unrevoked_idx
  ON iam.user_roles(user_id, role_code)
  WHERE revoked_at IS NULL;

CREATE TABLE privacy.consent_purposes (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  legal_basis text NOT NULL,
  is_required boolean NOT NULL DEFAULT false,
  default_retention_days integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_purposes_code_format CHECK (code ~ '^[a-z][a-z0-9_.]{1,63}$'),
  CONSTRAINT consent_purposes_retention_positive CHECK (
    default_retention_days IS NULL OR default_retention_days > 0
  )
);

INSERT INTO privacy.consent_purposes
  (code, name, description, legal_basis, is_required, default_retention_days)
VALUES
  ('account.core', 'Vận hành tài khoản', 'Xử lý dữ liệu tối thiểu để cung cấp tài khoản.', 'contract', true, 365),
  ('profile.personalization', 'Cá nhân hóa hồ sơ', 'Dùng hồ sơ và bằng chứng để cá nhân hóa gợi ý.', 'consent', false, 365),
  ('sharing.counselor', 'Chia sẻ với chuyên viên', 'Cho phép chuyên viên truy cập phạm vi người học chọn.', 'consent', false, 90),
  ('sharing.guardian', 'Chia sẻ với người giám hộ', 'Cho phép người giám hộ truy cập phạm vi được duyệt.', 'consent', false, 90),
  ('analytics.product', 'Phân tích sản phẩm', 'Dùng dữ liệu đã giảm định danh để cải thiện sản phẩm.', 'consent', false, 180),
  ('fairness.audit', 'Kiểm toán fairness', 'Dùng thuộc tính tự nguyện ở vùng dữ liệu cách ly để kiểm toán tổng hợp.', 'explicit_consent', false, 180),
  ('notifications.email', 'Thông báo email', 'Gửi nhắc việc và cập nhật theo lựa chọn.', 'consent', false, 365);

CREATE TRIGGER consent_purposes_set_updated_at
BEFORE UPDATE ON privacy.consent_purposes
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE privacy.policy_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_type text NOT NULL,
  version text NOT NULL,
  locale varchar(10) NOT NULL DEFAULT 'vi-VN',
  title text NOT NULL,
  content_uri text NOT NULL,
  content_sha256 text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  effective_at timestamptz,
  retired_at timestamptz,
  created_by_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT policy_versions_type_valid CHECK (
    policy_type IN ('terms_of_service', 'privacy_notice', 'consent_notice', 'minor_notice', 'sharing_notice')
  ),
  CONSTRAINT policy_versions_status_valid CHECK (status IN ('draft', 'active', 'retired')),
  CONSTRAINT policy_versions_hash_format CHECK (content_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT policy_versions_effective_consistent CHECK (
    (status = 'draft' AND effective_at IS NULL)
    OR (status IN ('active', 'retired') AND effective_at IS NOT NULL)
  ),
  CONSTRAINT policy_versions_retired_consistent CHECK (
    retired_at IS NULL OR (effective_at IS NOT NULL AND retired_at >= effective_at)
  ),
  UNIQUE (policy_type, version, locale)
);

CREATE UNIQUE INDEX policy_versions_one_active_idx
  ON privacy.policy_versions(policy_type, locale)
  WHERE status = 'active';

CREATE TABLE privacy.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  purpose_code text NOT NULL REFERENCES privacy.consent_purposes(code) ON DELETE RESTRICT,
  policy_version_id uuid NOT NULL REFERENCES privacy.policy_versions(id) ON DELETE RESTRICT,
  decision text NOT NULL,
  actor_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  actor_relationship text NOT NULL DEFAULT 'self',
  source text NOT NULL,
  supersedes_record_id uuid REFERENCES privacy.consent_records(id) ON DELETE RESTRICT,
  expires_at timestamptz,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT consent_records_decision_valid CHECK (decision IN ('granted', 'denied', 'withdrawn')),
  CONSTRAINT consent_records_actor_relationship_valid CHECK (
    actor_relationship IN ('self', 'guardian', 'authorized_representative', 'system')
  ),
  CONSTRAINT consent_records_source_valid CHECK (source IN ('web', 'mobile', 'assisted', 'import', 'system')),
  CONSTRAINT consent_records_expiry_valid CHECK (expires_at IS NULL OR expires_at > recorded_at),
  CONSTRAINT consent_records_not_self_supersede CHECK (
    supersedes_record_id IS NULL OR supersedes_record_id <> id
  ),
  CONSTRAINT consent_records_context_object CHECK (jsonb_typeof(context) = 'object')
);

CREATE INDEX consent_records_current_lookup_idx
  ON privacy.consent_records(user_id, purpose_code, recorded_at DESC);
CREATE INDEX consent_records_policy_idx ON privacy.consent_records(policy_version_id);

CREATE TABLE privacy.share_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  consent_record_id uuid NOT NULL REFERENCES privacy.consent_records(id) ON DELETE RESTRICT,
  relationship_type text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  revoked_at timestamptz,
  revoke_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT share_grants_different_users CHECK (owner_user_id <> recipient_user_id),
  CONSTRAINT share_grants_relationship_valid CHECK (
    relationship_type IN ('counselor', 'guardian', 'supporter', 'institution_staff')
  ),
  CONSTRAINT share_grants_status_valid CHECK (status IN ('pending', 'active', 'expired', 'revoked', 'rejected')),
  CONSTRAINT share_grants_window_valid CHECK (valid_until > valid_from),
  CONSTRAINT share_grants_revoke_consistent CHECK (
    (status = 'revoked' AND revoked_at IS NOT NULL)
    OR status <> 'revoked'
  )
);

CREATE INDEX share_grants_owner_active_idx
  ON privacy.share_grants(owner_user_id, valid_until)
  WHERE status = 'active';
CREATE INDEX share_grants_recipient_active_idx
  ON privacy.share_grants(recipient_user_id, valid_until)
  WHERE status = 'active';

CREATE TRIGGER share_grants_set_updated_at
BEFORE UPDATE ON privacy.share_grants
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE privacy.share_grant_scopes (
  share_grant_id uuid NOT NULL REFERENCES privacy.share_grants(id) ON DELETE CASCADE,
  scope_code text NOT NULL,
  access_level text NOT NULL DEFAULT 'read',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (share_grant_id, scope_code),
  CONSTRAINT share_grant_scopes_code_valid CHECK (
    scope_code IN (
      'profile.summary', 'profile.education', 'profile.evidence', 'profile.skills',
      'recommendations', 'roadmaps', 'roadmaps.edit', 'counseling.shared_notes'
    )
  ),
  CONSTRAINT share_grant_scopes_access_valid CHECK (access_level IN ('read', 'comment', 'edit')),
  CONSTRAINT share_grant_scopes_edit_restricted CHECK (
    access_level <> 'edit' OR scope_code = 'roadmaps.edit'
  )
);

CREATE TABLE privacy.guardian_relationships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learner_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  guardian_user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  relationship_label text NOT NULL,
  verification_method text,
  status text NOT NULL DEFAULT 'pending',
  verified_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guardian_relationships_different_users CHECK (learner_user_id <> guardian_user_id),
  CONSTRAINT guardian_relationships_status_valid CHECK (status IN ('pending', 'verified', 'rejected', 'ended')),
  CONSTRAINT guardian_relationships_verified_consistent CHECK (
    (status = 'verified' AND verified_at IS NOT NULL)
    OR status <> 'verified'
  ),
  CONSTRAINT guardian_relationships_ended_consistent CHECK (
    (status = 'ended' AND ended_at IS NOT NULL)
    OR status <> 'ended'
  ),
  UNIQUE (learner_user_id, guardian_user_id)
);

CREATE TRIGGER guardian_relationships_set_updated_at
BEFORE UPDATE ON privacy.guardian_relationships
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE privacy.data_subject_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE RESTRICT,
  request_type text NOT NULL,
  status text NOT NULL DEFAULT 'submitted',
  requested_scope text NOT NULL DEFAULT 'all_personal_data',
  identity_verified_at timestamptz,
  assigned_to_user_id uuid REFERENCES iam.users(id) ON DELETE SET NULL,
  due_at timestamptz NOT NULL,
  completed_at timestamptz,
  rejection_reason text,
  result_object_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT data_subject_requests_type_valid CHECK (
    request_type IN ('access', 'export', 'correct', 'delete', 'restrict_processing', 'withdraw_consent')
  ),
  CONSTRAINT data_subject_requests_status_valid CHECK (
    status IN ('submitted', 'identity_check', 'in_progress', 'completed', 'partially_completed', 'rejected', 'cancelled')
  ),
  CONSTRAINT data_subject_requests_due_valid CHECK (due_at > created_at),
  CONSTRAINT data_subject_requests_completion_consistent CHECK (
    (status IN ('completed', 'partially_completed') AND completed_at IS NOT NULL)
    OR status NOT IN ('completed', 'partially_completed')
  ),
  CONSTRAINT data_subject_requests_rejection_consistent CHECK (
    (status = 'rejected' AND rejection_reason IS NOT NULL)
    OR status <> 'rejected'
  )
);

CREATE INDEX data_subject_requests_user_idx
  ON privacy.data_subject_requests(user_id, created_at DESC);
CREATE INDEX data_subject_requests_work_queue_idx
  ON privacy.data_subject_requests(status, due_at)
  WHERE status IN ('submitted', 'identity_check', 'in_progress');

CREATE TRIGGER data_subject_requests_set_updated_at
BEFORE UPDATE ON privacy.data_subject_requests
FOR EACH ROW EXECUTE FUNCTION catalog.set_updated_at();

CREATE TABLE privacy.fairness_attribute_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES iam.users(id) ON DELETE CASCADE,
  consent_record_id uuid NOT NULL REFERENCES privacy.consent_records(id) ON DELETE RESTRICT,
  attribute_code text NOT NULL,
  encrypted_value bytea NOT NULL,
  encryption_key_version text NOT NULL,
  collected_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  deleted_at timestamptz,
  CONSTRAINT fairness_attributes_code_valid CHECK (
    attribute_code IN ('gender', 'ethnicity', 'religion', 'disability', 'socioeconomic_band')
  ),
  CONSTRAINT fairness_attributes_expiry_valid CHECK (expires_at > collected_at),
  UNIQUE (user_id, attribute_code, collected_at)
);

CREATE INDEX fairness_attributes_expiry_idx
  ON privacy.fairness_attribute_responses(expires_at)
  WHERE deleted_at IS NULL;

COMMENT ON SCHEMA privacy IS
  'PII consent, sharing, data-subject rights and isolated voluntary fairness attributes.';
COMMENT ON TABLE privacy.consent_records IS
  'Append-only decisions. Current consent is the latest valid decision per user and purpose.';
COMMENT ON TABLE privacy.fairness_attribute_responses IS
  'Restricted encrypted data for aggregate fairness audits; never available to recommendation ranking.';

COMMIT;
