# Từ điển dữ liệu

## 1. Phạm vi và quy ước

Tài liệu này liệt kê đầy đủ 81 bảng của target-state schema. DDL là nguồn chính xác cho kiểu, default, `CHECK`, `UNIQUE`, `FK`, index và RLS. Từ điển này bổ sung ngữ nghĩa nghiệp vụ, ownership, lifecycle, độ nhạy cảm và phân kỳ.

### 1.1. Từ viết tắt

| Ký hiệu | Nghĩa |
|---|---|
| PK | Primary key |
| FK | Foreign key |
| UK | Candidate/unique key |
| PII | Dữ liệu nhận diện cá nhân |
| DSR | Yêu cầu quyền chủ thể dữ liệu: access/export/correct/delete/restrict |
| Source of truth | Bảng gốc có thẩm quyền; bảng projection/cache phải rebuild được |
| Append-oriented | Thêm observation/event mới; hạn chế sửa lịch sử |

### 1.2. Domain dùng chung

| Domain | Kiểu vật lý | Ý nghĩa |
|---|---|---|
| `catalog.score_01` | `numeric(5,4)` | Điểm, trọng số hoặc confidence từ 0 đến 1 |
| `catalog.proficiency_0_5` | `smallint` | Mức năng lực 0 đến 5 |
| `catalog.currency_code` | `varchar(3)` | ISO 4217 viết hoa |

### 1.3. Cột kỹ thuật chung

- `id uuid DEFAULT gen_random_uuid()` cho business entity.
- `created_at timestamptz DEFAULT now()` ghi thời điểm tạo.
- `updated_at timestamptz` có trigger `catalog.set_updated_at()` ở bảng mutable.
- `*_at` là thời điểm UTC; `*_on` là ngày lịch.
- `metadata`, `configuration`, `details`, `context`, `rubric`, `snapshot_data`, `payload` phải là JSON object khi nghiệp vụ yêu cầu.
- Các bảng event/log volume lớn có `bigint GENERATED ALWAYS AS IDENTITY`.

### 1.4. Phân loại bảo mật

| Mã | Lớp dữ liệu |
|---|---|
| C0 | Public/reference hoặc published aggregate |
| C1 | Internal operational |
| C2 | Personal |
| C3 | Sensitive personal |
| C4 | Restricted authentication/fairness |

### 1.5. Giai đoạn

- FDN: foundation trước vertical feature.
- MVP: bắt buộc cho phiên bản nghiệp vụ đầu tiên.
- PLT: pilot sau khi legal/product phê duyệt.
- SCL: scale optimization; schema nguồn có thể đã tồn tại từ trước.

## 2. Schema `catalog`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `catalog.locations` | Danh mục địa lý phân cấp dùng chung | PK `id`; self-FK `parent_id`; UK `(country_code, code)` | `country_code`, `admin_level`, `code`, `name_vi`, `name_en`, `time_zone`, `latitude`, `longitude`, `is_active` | Không hard-delete khi đã được tham chiếu; inactive khi ngừng dùng | C0 | FDN |
| `catalog.organizations` | Danh mục employer/provider/data partner | PK `id`; FK `headquarters_location_id` | `organization_type`, `name`, generated `normalized_name`, `registration_code`, `website_url`, `description`, `verification_status`, `verified_at`, `is_active`, `metadata` | Merge/dedup bằng workflow; giữ ID ổn định | C0/C1 | FDN |
| `catalog.data_sources` | Source registry và điều kiện sử dụng | PK `id`; FK `owner_organization_id`; UK `code` | `source_type`, `access_method`, `base_url`, `license_name`, `terms_url`, `permitted_purposes`, `retention_days`, `refresh_interval_minutes`, `status`, legal/sync timestamp, `metadata` | Pause/revoke/retire; không xóa khi có lineage | C1 | FDN |

## 3. Schema `iam`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `iam.users` | Account identity ổn định | PK `id` | `full_name`, `status`, `locale`, `time_zone`, `last_login_at`, `deactivated_at`, `deletion_scheduled_at` | Pending → active/locked → deactivated/deletion pending | C2 | FDN |
| `iam.user_emails` | Email đăng nhập/xác minh | PK `id`; FK `user_id`; UK `email_normalized`; partial UK một primary/user | `email`, generated `email_normalized`, `is_primary`, `verified_at` | Có thể thêm/đổi; cascade khi account purge | C2 | FDN |
| `iam.password_credentials` | Credential local password | PK/FK `user_id` | `password_hash`, `hashing_algorithm`, `password_changed_at`, `failed_attempt_count`, `locked_until`, `requires_password_change` | Rehash/rotate; purge cùng account | C4 | FDN |
| `iam.auth_sessions` | Phiên đăng nhập opaque-token | PK `id`; FK `user_id`; UK `token_hash` | `ip_hash`, `user_agent_hash`, `expires_at`, `last_seen_at`, `revoked_at`, `revoke_reason` | TTL ngắn; revoke/logout; purge định kỳ | C4 | FDN |
| `iam.one_time_tokens` | Verify email/reset/change/invite | PK `id`; FK `user_id`, `email_id`; UK `token_hash` | `purpose`, `attempt_count`, `expires_at`, `consumed_at` | Một lần, TTL rất ngắn; purge sau hết hạn | C4 | FDN |
| `iam.roles` | Danh mục application role | PK `code` | `name`, `description`, `is_system_role` | Seed qua migration; thay đổi có review | C1 | FDN |
| `iam.user_roles` | Lịch sử cấp/revoke role | Composite PK `(user_id, role_code, granted_at)`; FK user/role/grantor | `expires_at`, `revoked_at` | Không ghi đè lần cấp cũ; lần cấp mới là row mới | C2/C1 | FDN |

## 4. Schema `privacy`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `privacy.consent_purposes` | Danh mục mục đích xử lý | PK `code` | `name`, `description`, `legal_basis`, `is_required`, `default_retention_days`, `is_active` | Version bằng migration; không tái sử dụng code cho nghĩa khác | C1 | FDN |
| `privacy.policy_versions` | Nội dung notice/terms được version | PK `id`; UK `(policy_type, version, locale)`; partial UK một active/type/locale | `title`, `content_uri`, `content_sha256`, `status`, `effective_at`, `retired_at`, `created_by_user_id` | Draft → active → retired; không sửa nội dung đã active | C1 | FDN |
| `privacy.consent_records` | Lịch sử quyết định consent append-only | PK `id`; FK user, purpose, policy, actor, self-FK supersedes | `decision`, `actor_relationship`, `source`, `expires_at`, `context`, `recorded_at` | Insert quyết định mới; không update/delete bằng app role | C2/C3 | FDN |
| `privacy.share_grants` | Quyền chia sẻ giữa owner và recipient | PK `id`; FK owner/recipient/consent | `relationship_type`, `status`, `valid_from`, `valid_until`, `revoked_at`, `revoke_reason` | Pending/active → expired/revoked/rejected | C3 | MVP |
| `privacy.share_grant_scopes` | Scope và access level của grant | Composite PK `(share_grant_id, scope_code)` | `access_level` | Sửa/xóa chỉ bởi owner; hết hiệu lực theo parent | C3 | MVP |
| `privacy.guardian_relationships` | Quan hệ learner–guardian đã xác minh | PK `id`; FK learner/guardian; UK cặp user | `relationship_label`, `verification_method`, `status`, `verified_at`, `ended_at` | Pending → verified/rejected/ended | C3 | PLT |
| `privacy.data_subject_requests` | Workflow quyền dữ liệu | PK `id`; FK user/assignee | `request_type`, `status`, `requested_scope`, `identity_verified_at`, `due_at`, `completed_at`, `rejection_reason`, `result_object_key` | Giữ đến khi hết audit/legal retention; result object có TTL | C3 | MVP |
| `privacy.fairness_attribute_responses` | Thuộc tính tự nguyện, mã hóa để audit tổng hợp | PK `id`; FK user/consent; UK `(user, attribute, collected_at)` | `attribute_code`, `encrypted_value`, `encryption_key_version`, `collected_at`, `expires_at`, `deleted_at` | TTL ngắn; crypto-shred/purge; không cấp cho recommendation worker | C4 | PLT |

## 5. Schema `taxonomy`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `taxonomy.releases` | Phiên bản taxonomy được publish | PK `id`; UK `version`; partial UK một active | `status`, `description`, `content_sha256`, `published_by_user_id`, `published_at`, `retired_at` | Draft → active → retired/rejected | C0/C1 | FDN |
| `taxonomy.skills` | Skill identity chuẩn | PK `id`; UK `code`; FK introduced/retired release | `preferred_name_vi`, `preferred_name_en`, `skill_type`, `description`, `status` | ID ổn định; deprecated/merged/retired có release | C0 | FDN |
| `taxonomy.skill_aliases` | Tên biến thể skill | PK `id`; FK skill/source/release; UK `(skill, locale, normalized_alias, release)` | `alias`, generated `normalized_alias`, `locale`, `alias_type`, `mapping_confidence`, `is_active` | Version theo release; alias mơ hồ được phép map nhiều skill | C0/C1 | FDN |
| `taxonomy.skill_relations` | Quan hệ skill graph | PK `id`; FK source/target skill, source data, release; composite UK theo quan hệ | `relation_type`, `strength`, `rationale` | Bất biến trong release; release mới thay quan hệ | C0 | MVP |
| `taxonomy.occupations` | Occupation/role identity chuẩn | PK `id`; self-FK parent; UK `code`; FK release | `preferred_name_vi`, `preferred_name_en`, `description`, `occupation_level`, `status` | ID ổn định; phân cấp family→occupation→role→specialization | C0 | FDN |
| `taxonomy.occupation_aliases` | Job-title/alias chuẩn hóa về nghề | PK `id`; FK occupation/source/release; UK theo occupation/locale/alias/release | `alias`, generated `normalized_alias`, `locale`, `alias_type`, `mapping_confidence`, `is_active` | Version theo release | C0/C1 | FDN |
| `taxonomy.occupation_tasks` | Nhiệm vụ điển hình của nghề | PK `id`; FK occupation/source/release; UK `(occupation, task_code, release)` | `task_text_vi`, `task_text_en`, `importance`, `frequency`, `is_active` | Version theo release | C0 | MVP |
| `taxonomy.occupation_skills` | Skill requirement của nghề | Composite PK `(occupation, skill, release, requirement_type)` | `importance`, `minimum_proficiency`, `evidence_basis`, `source_id`, `sample_size` | Version theo release; không update lịch sử đã publish | C0/C1 | MVP |
| `taxonomy.occupation_relations` | Adjacent/progression/career-change graph | PK `id`; FK source/target occupation/release; composite UK | `relation_type`, `transferability`, `rationale` | Version theo release | C0 | MVP |

## 6. Schema `profile`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `profile.learner_profiles` | Hồ sơ lõi và owner boundary | PK/FK `user_id`; FK current location | `birth_month`, `birth_year`, `learner_stage`, `onboarding_status`, availability, budget/currency, relocation, work modes, `support_needs`, `profile_revision` | Mutable với optimistic locking; purge/anonymize theo DSR | C3 | FDN |
| `profile.learner_goals` | Mục tiêu chủ động của learner | PK `id`; FK learner/occupation | `goal_type`, `title`, `description`, `target_date`, `priority`, `status`, `completed_at` | Draft/active/paused/completed/abandoned | C2 | MVP |
| `profile.preference_dimensions` | Danh mục interest/value/priority | PK `code` | `category`, `name_vi`, `name_en`, `description`, `ranking_eligible`, `is_active` | Seed/version qua migration/content governance | C0/C1 | FDN |
| `profile.learner_preferences` | Observation lịch sử về sở thích/ưu tiên | PK `id`; FK learner/dimension; self-FK supersedes | `affinity`, `importance`, `confidence`, `source_type`, `source_reference`, `observed_at` | Append-oriented; view chọn bản mới nhất | C2 | MVP |
| `profile.learner_location_preferences` | Ưu tiên địa lý theo study/internship/job | PK `id`; FK learner/location; UK `(learner, location, context)` | `preference_level`, `remote_acceptable`, `relocation_required_acceptable` | Mutable theo ý người học | C2 | MVP |
| `profile.education_records` | Lịch sử học vấn | PK `id`; FK learner/institution | institution raw fallback, `education_level`, `program_name`, `field_of_study`, date range, `status`, `grade_summary`, `verification_status` | Mutable đến khi verified; không sửa tài liệu gốc | C3 | MVP |
| `profile.academic_results` | Kết quả môn/period có scale | PK `id`; FK education record | `subject_name`, `result_value`, `result_text`, `scale_min`, `scale_max`, `period_label`, `observed_at` | Cascade với education record; tạo evidence/observation qua service | C3 | MVP |
| `profile.evidence_items` | Metadata bằng chứng cá nhân | PK `id`; FK learner/issuer/creator | `evidence_type`, `title`, `description`, `source_type`, `source_url`, `occurred_on`, `verification_status`, `visibility`, `metadata`, `deleted_at` | Soft-delete để xử lý link; file purge theo workflow | C3 | MVP |
| `profile.evidence_assets` | Metadata object storage | PK `id`; FK evidence; UK `object_key` | `original_file_name`, `media_type`, `byte_size`, `sha256`, `malware_scan_status`, `scanned_at`, `deleted_at` | Object chỉ dùng sau scan clean; purge/crypto-shred theo DSR | C3 | MVP |
| `profile.skill_observations` | Source of truth của skill claim/measure | PK `id`; FK learner/skill/evidence/observer | `source_type`, `proficiency_level`, `confidence`, `assessment_method`, `source_detail`, `observed_at`, `expires_at`, `retracted_at` | Append-oriented; có expiry/retraction; không gộp nguồn | C3 | MVP |
| `profile.skill_summaries` | Projection hiện tại để matching nhanh | Composite PK `(learner, skill)` | self/evidence/inferred/combined level, `confidence`, observation count/latest, `algorithm_version`, `calculated_at` | Rebuildable/upsert; không phải bằng chứng gốc | C2 | MVP |
| `profile.profile_snapshots` | Input immutable cho recommendation/audit | PK `id`; FK learner; UK `(learner, revision, purpose)` | `snapshot_data`, `content_sha256`, `purpose`, `expires_at` | Immutable và time-limited; purge theo purpose | C3 | MVP |

## 7. Schema `market`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `market.ingestion_runs` | Một lần chạy pipeline nguồn | PK `id`; FK data source | `run_type`, `status`, source window, `configuration`, counters, `started_at`, `completed_at`, `error_summary` | Append; status chuyển theo workflow | C1 | MVP |
| `market.raw_records` | Payload nguồn ngắn hạn cho replay/quarantine | Identity PK `id`; FK run/source; UK `(source, external_id, payload_sha256)` | `payload`, `processing_status`, error code/detail, `received_at`, `processed_at`, `purge_after` | Bắt buộc purge theo license/retention; partition khi scale | C1/C2 tùy nguồn | MVP/SCL |
| `market.job_postings` | Identity ổn định của tin theo nguồn | PK `id`; FK source/employer/self duplicate; UK `(source, external_id)` | `canonical_url`, `status`, `first_seen_at`, `last_seen_at`, `closed_at` | Không ghi đè content; status và duplicate pointer mutable | C0/C1 | MVP |
| `market.job_posting_versions` | Revision nội dung đã chuẩn hóa | PK `id`; FK posting/run/location; UK version; index content hash; partial UK current | title/description/search vector, location/work/employment/experience, salary fields, posted/expiry/captured, `is_current` | Mỗi content change là version mới; hash ngăn ghi lặp liên tiếp ở service nhưng cho phép nội dung quay về ở version sau | C0/C1 | MVP |
| `market.job_occupation_mappings` | Mapping version tin sang nghề | PK `id`; FK job version/occupation/model/reviewer; UK theo version/occupation/type | `mapping_type`, `confidence`, `mapping_method`, `review_status`, review time | Model/manual/hybrid; low confidence vào review queue | C1 | MVP |
| `market.job_skill_mentions` | Skill phrase được trích xuất | PK `id`; FK job version/skill/model/reviewer | `requirement_type`, `raw_phrase`, minimum proficiency/years, `confidence`, `extraction_method`, `review_status` | Có thể nhiều phrase cùng skill; rejected không vào aggregate | C1 | MVP |
| `market.job_quality_flags` | Cờ duplicate/scam/outlier/quality | PK `id`; FK job version/model/users; UK `(version, flag, method)` | `flag_code`, `severity`, `details`, `detection_method`, `status`, resolution fields | Open → confirmed/dismissed/resolved | C1 | MVP |
| `market.labor_market_signals` | Aggregate publishable có provenance | PK `id`; FK occupation/skill/location | dimensions, window/as-of, counts, demand/growth, salary percentiles/sample, supply sample, shortage class, confidence, methodology, freshness, limitations, status | Draft → published → superseded/rejected; không sửa published | C0/C1 | MVP |
| `market.signal_source_stats` | Đóng góp từng nguồn vào signal | Composite PK `(signal, source)` | posting/accepted count, `source_weight`, coverage window | Cascade theo signal; giữ để giải thích độ phủ | C1 | MVP |

## 8. Schema `learning`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `learning.opportunities` | Identity ổn định của chương trình/cơ hội | PK `id`; FK provider/source; UK `(source, external_id)` | `opportunity_type`, `status` | Draft/active/inactive/expired/retired | C0/C1 | MVP |
| `learning.opportunity_versions` | Nội dung cụ thể được review | PK `id`; FK opportunity/location/reviewer; UK version; index content hash; partial UK current | title/description, delivery, URL, duration, cost/currency, dates, eligibility, sponsorship/disclosure, verification, expiry, `is_current` | Version mới khi nội dung đổi; cùng nội dung có thể xuất hiện lại sau một version khác; stale/expired tự ẩn | C0/C1 | MVP |
| `learning.opportunity_skills` | Prerequisite/outcome/practice/assessment skill | Composite PK `(opportunity_version, skill, relation_type)` | `target_proficiency`, `importance`, `evidence_basis` | Bất biến theo version | C0/C1 | MVP |
| `learning.opportunity_occupations` | Quan hệ cơ hội với nghề | Composite PK `(opportunity_version, occupation, relation_type)` | `relevance`, `rationale` | Bất biến theo version | C0/C1 | MVP |

## 9. Schema `governance`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `governance.model_releases` | Registry phiên model/prompt đã kiểm soát | PK `id`; FK taxonomy release/approver; UK identity model+prompt | type/provider/name/version/prompt, `configuration`, `artifact_sha256`, `status`, approval/activation/retire timestamps | Draft → validation → approved/active → paused/retired | C1 | MVP |
| `governance.data_quality_results` | Kết quả rule chất lượng theo entity | Identity PK `id`; FK source/run/resolver; controlled `entity_type + entity_id` | `rule_code`, `severity`, `status`, `score`, `details`, evaluated/resolution fields | Append cho mỗi evaluation; failed được resolve/waive có lý do | C1 | MVP |
| `governance.audit_events` | Ledger access/change tối thiểu | Identity PK `id`; FK actor/subject user | `action_code`, `resource_type`, `resource_id`, `purpose_code`, `outcome`, request/trace id, hashed client data, `metadata`, `occurred_at` | Append-only với app role; retention/partition theo policy | C2/C3 | FDN/SCL |
| `governance.issue_reports` | Khiếu nại bias/privacy/data/content/security | PK `id`; FK reporter/assignee/run/option; controlled subject | `issue_type`, `severity`, `status`, title/description, resolution fields | Submitted → triaged/investigating → resolved/rejected/reopened | C3 | MVP |
| `governance.fairness_test_runs` | Một lần chạy test suite fairness | PK `id`; FK model/taxonomy/approver | `test_suite_version`, `scope_definition`, `status`, `summary`, timestamps | Append; approval chỉ cho passed | C1/C3 aggregate | PLT |
| `governance.fairness_metrics` | Metric/cohort của fairness run | PK `id`; FK test run | `metric_code`, cohort/comparison definition, value, threshold, sample size, `passed`, notes | Bất biến sau run/approval | C1/C3 aggregate | PLT |
| `governance.outbox_events` | Transactional outbox | PK `id`; logical aggregate key | `event_type`, `payload`, `status`, `attempt_count`, available/lock/processed timestamps, `last_error` | Pending → processing → processed/failed/dead-letter; purge sau retention | C1; payload không được chứa secret | MVP |

## 10. Schema `recommendation`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `recommendation.runs` | Execution context tái tạo được | PK `id`; FK learner/snapshot/model/taxonomy | `trigger_type`, `status`, `market_data_as_of`, `input_sha256`, `run_configuration`, timestamps, failure fields | Queued → running → completed/warning/failed/cancelled; không sửa output run cũ | C3 | MVP |
| `recommendation.career_options` | Một lựa chọn nghề trong run | PK `id`; FK run/occupation; UK `(run, occupation)` và `(run, rank)` | `option_category`, `display_rank`, internal `retrieval_score`, `confidence`, `state`, summary, uncertainty, disclaimer | Bất biến sau run complete; superseded qua run mới | C3 | MVP |
| `recommendation.option_dimensions` | Sáu chiều đánh giá hiển thị riêng | PK `id`; FK option; UK dimension/sort trong option | `dimension_code`, `score`, `confidence`, `display_label`, `explanation`, `sort_order` | Bất biến theo option | C3 | MVP |
| `recommendation.option_reasons` | Lý do/đánh đổi/bất định/bước khám phá | PK `id`; FK option; UK sort | `reason_type`, `statement`, `confidence`, `sort_order` | Bất biến theo option | C3 | MVP |
| `recommendation.option_evidence_links` | Lineage đến evidence/skill observation | PK `id`; FK option/reason/evidence/observation | `contribution_direction`, `contribution_weight`, `explanation` | Bất biến theo option; source bị xóa thì workflow phải rebuild/redact | C3 | MVP |
| `recommendation.option_market_links` | Lineage đến published signal | PK `id`; FK option/reason/signal; composite UK | `usage_type`, `explanation` | Bất biến; signal được giữ/supersede, không hard-delete | C2/C1 | MVP |
| `recommendation.option_skill_gaps` | Khoảng trống có thể hành động | PK `id`; FK option/skill; UK `(option, skill)` | current/required proficiency, `gap_size`, `priority`, `confidence`, `validation_action` | Bất biến theo run; recalculated trong run mới | C3 | MVP |
| `recommendation.option_learning_links` | Tuyến học cụ thể có version | PK `id`; FK option/opportunity version; UK option+version/sort | `route_type`, `relevance`, estimated duration/cost/currency, `tradeoff_summary`, `sort_order` | Bất biến; UI cảnh báo nếu version đã stale/expired | C2 | MVP |
| `recommendation.option_feedback` | Phản hồi learner append-oriented | PK `id`; FK option/user | `stance`, `reason_code`, `comment`, `retracted_at` | Insert mới; có thể retract; không dùng để khóa vĩnh viễn lựa chọn | C3 | MVP |

## 11. Schema `roadmap`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `roadmap.roadmaps` | Aggregate roadmap của learner | PK `id`; FK learner/goal/source option/current version | `title`, `primary_stage`, `status`, `archived_at` | Draft/active/paused/completed/archived | C3 | MVP |
| `roadmap.roadmap_versions` | Phiên bản nội dung plan | PK `id`; FK roadmap/base version/author/model; UK `(roadmap, version)`; partial UK one published | `authored_by_type`, `change_reason`, `status`, `published_at` | Draft → published → superseded/rejected | C3 | MVP |
| `roadmap.milestones` | Bước hành động trong một version | PK `id`; FK version/superseded milestone; UK sort trong version | `stage`, title/description, `necessity`, planned dates, effort, `completion_criteria`, `sort_order` | Bất biến sau publish; version mới supersede | C3 | MVP |
| `roadmap.milestone_dependencies` | Dependency graph | Composite PK `(milestone, depends_on)` | `dependency_type` | Cùng roadmap version; service chặn cycle | C2 | MVP |
| `roadmap.milestone_skills` | Skill mà milestone phát triển/chứng minh | Composite PK `(milestone, skill, purpose)` | `target_proficiency` | Bất biến theo plan version | C2 | MVP |
| `roadmap.milestone_evidence_requirements` | Tiêu chí bằng chứng quan sát được | PK `id`; FK milestone | `evidence_type`, `requirement_text`, `minimum_count`, `rubric` | Bất biến theo plan version | C2/C3 | MVP |
| `roadmap.progress_events` | Source of truth tiến độ append-only | PK `id`; FK roadmap/milestone/actor | `status`, `completion_percent`, `note`, `blocker_text`, `occurred_at` | Insert event; view lấy event mới nhất | C3 | MVP |
| `roadmap.milestone_evidence_links` | Evidence đã nộp/review cho milestone | Composite PK `(milestone, evidence)`; FK reviewer | `review_status`, `reviewed_at`, `review_note` | Submitted → accepted/changes requested/rejected | C3 | MVP |

## 12. Schema `counseling`

| Bảng | Mục đích/source of truth | Khóa và quan hệ | Cột nghiệp vụ | Lifecycle | Lớp | Giai đoạn |
|---|---|---|---|---|---|---|
| `counseling.relationships` | Quan hệ tư vấn được grant cho phép | PK `id`; FK learner/counselor/share grant; composite UK | `status`, `started_at`, `ended_at` | Pending → active/paused → ended/rejected; grant hết hạn làm mất access | C3 | PLT |
| `counseling.appointments` | Lịch phiên tư vấn | PK `id`; FK relationship/creator | scheduled window, `status`, `agenda`, `meeting_reference`, `cancellation_reason` | Scheduled/confirmed/completed/cancelled/no-show/rescheduled | C3 | PLT |
| `counseling.session_notes` | Ghi chú có visibility minh bạch | PK `id`; FK appointment/author | `visibility`, `note_text`, learner notified/acknowledged timestamps | Author sửa theo policy; retention theo counseling policy | C3 | PLT |
| `counseling.action_items` | Việc tiếp theo từ phiên tư vấn | PK `id`; FK appointment/roadmap/milestone/assignee | `title`, `due_on`, `status`, `completed_at` | Open → in-progress/completed/cancelled | C3 | PLT |
| `counseling.recommendation_reviews` | Đánh giá đề xuất của counselor | PK `id`; FK relationship/option/reviewer; UK ba khóa | `review_outcome`, `feedback_text` | Một review/counselor/relationship/option; issue nghiêm trọng tạo issue report | C3 | PLT |

## 13. View nghiệp vụ

| View | Ý nghĩa | Quy tắc |
|---|---|---|
| `privacy.current_consents` | Quyết định consent mới nhất theo user/purpose | `DISTINCT ON`, ưu tiên `recorded_at DESC`; caller vẫn phải xét expiry và decision |
| `profile.current_preferences` | Preference observation mới nhất theo dimension | Không xóa lịch sử; RLS theo caller |
| `market.current_job_posting_versions` | Canonical/current job content | Loại duplicate, quarantined và removed |
| `learning.current_opportunity_versions` | Current content của opportunity active | Giữ verification/expiry để caller lọc đúng use case |
| `recommendation.latest_completed_runs` | Run completed mới nhất mỗi learner | Security-invoker để RLS của base table có hiệu lực |
| `roadmap.current_milestone_progress` | Progress event mới nhất mỗi milestone | Không thay thế event history |

## 14. Controlled polymorphic reference

Chỉ hai khu vực dùng logical reference thay vì FK:

1. `governance.data_quality_results(entity_type, entity_id)` vì một rule engine đánh giá nhiều schema và có entity dùng `bigint`/UUID.
2. `governance.outbox_events(aggregate_type, aggregate_id)` vì event phải sống độc lập với aggregate và có thể gửi cho mọi miền.

`governance.issue_reports.subject_type/subject_id` chỉ là fallback cho taxonomy/market/content; trường hợp recommendation có FK trực tiếp `recommendation_run_id` và `career_option_id`.

Service phải validate allowlist type, chuẩn hóa ID thành text/UUID tương ứng và ghi audit. Không dùng các reference này làm join chính của màn hình người dùng.
