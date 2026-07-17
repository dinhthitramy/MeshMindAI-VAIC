# Bảo mật, vận hành và kế hoạch migration PostgreSQL

## 1. Mục tiêu vận hành

Database phải đáp ứng đồng thời:

- người học chỉ truy cập dữ liệu của mình;
- recipient chỉ truy cập đúng scope, access level và thời hạn;
- worker chỉ đọc dữ liệu cần cho nhiệm vụ;
- dữ liệu fairness/auth bị cách ly;
- một đề xuất lịch sử tái dựng được nguồn, phiên bản và phương pháp;
- raw/PII được xóa theo retention mà không phá dữ liệu aggregate hợp lệ;
- backup có thể restore và được diễn tập;
- migration không làm mất dữ liệu `public.users` hiện có.

## 2. Mô hình database role

Các role trong `005_security_rls.sql` là NOLOGIN group role. Mỗi environment tạo LOGIN role riêng, kế thừa đúng một hoặc một tập tối thiểu đã duyệt.

| DB role | Dùng bởi | Quyền chính | Không được phép |
|---|---|---|---|
| `meshmind_app` | Backend phục vụ request người dùng | IAM/profile/privacy/recommendation/roadmap/counseling qua RLS; đọc published catalog | Bypass RLS, đọc fairness plaintext, mutate audit |
| `meshmind_market_worker` | ETL thị trường/content | CRUD catalog/taxonomy/market/learning; DQ/outbox | Đọc profile/fairness/credential |
| `meshmind_recommendation_worker` | Job profile inference/recommendation | Đọc profile được allowlist, taxonomy/signal/learning; ghi recommendation/summary/outbox | Đọc fairness attributes, password/token, counseling notes |
| `meshmind_auditor` | Ethics/privacy audit service | Đọc audit/issue/fairness aggregate; ghi workflow audit | Đọc raw fairness row hoặc credential |
| `meshmind_readonly` | Kỹ thuật viên/BI giới hạn | Đọc reference/market/learning không PII | Đọc profile/IAM/private governance |
| Migration owner | CI/CD tách biệt | DDL, owner object | Không dùng cho runtime; credential chỉ mở trong deploy window |

Không cấp `SUPERUSER`, `BYPASSRLS`, `CREATEDB`, `CREATEROLE` hoặc `REPLICATION` cho runtime role. File tạo group role do DBA chạy; login credential do secret manager cấp và rotate.

## 3. Contract RLS cho request người dùng

Mỗi request đã xác thực phải chạy query cá nhân trong transaction:

```sql
BEGIN;
SET LOCAL app.current_user_id = '00000000-0000-0000-0000-000000000000';
SET LOCAL statement_timeout = '5s';
SET LOCAL lock_timeout = '1s';

-- Các query nghiệp vụ trong cùng transaction.

COMMIT;
```

UUID trong ví dụ là định dạng, không phải giá trị được phép dùng thực tế.

Yêu cầu bắt buộc:

1. Chỉ lấy user id từ session đã verify; không nhận trực tiếp từ body/query string.
2. Dùng `SET LOCAL`, không dùng `SET`, để giá trị tự reset khi transaction kết thúc.
3. Không thực thi query PII ngoài transaction có context.
4. Pool connection phải rollback transaction lỗi trước khi trả connection.
5. Worker dùng credential riêng và policy riêng; không giả user id.
6. Log `request_id`/`trace_id`, không log SQL parameter nhạy cảm.
7. Test integration phải chứng minh connection reuse không rò context giữa user A và B.

RLS dựa trên custom GUC là lớp phòng thủ cho lỗi truy vấn/ownership, không phải biên chống lại SQL injection trong chính `meshmind_app`: database login này có khả năng đặt một UUID khác. Vì vậy parameterization, validation session, giới hạn endpoint, transaction wrapper và chống injection vẫn là bắt buộc. Nếu cần mức cô lập chống lại application compromise, phải bổ sung broker/role-per-session hoặc cơ chế claim được database xác minh qua một ADR riêng.

## 4. Ma trận scope chia sẻ

| Scope | Dữ liệu dự kiến | Read | Comment | Edit |
|---|---|---:|---:|---:|
| `profile.summary` | stage, goal, preference summary | Có | Không | Không |
| `profile.education` | education/academic records được share | Có | Không | Không |
| `profile.evidence` | evidence metadata/file được share | Có | Không | Không |
| `profile.skills` | observation/summary skill | Có | Không | Không |
| `recommendations` | run, option, dimension, reason và lineage | Có | Có qua review riêng | Không |
| `roadmaps` | plan/progress hiện hành | Có | Có qua action/review | Không |
| `roadmaps.edit` | version/milestone/progress | Có | Có | Có |
| `counseling.shared_notes` | ghi chú visibility shared | Có | Theo workflow | Theo tác giả |

Không dùng JSON scope tự do. Mở scope mới cần migration/check/RLS test.

## 5. Mã hóa và quản lý secret

### 5.1. In transit và at rest

- Production bắt buộc TLS đến PostgreSQL với certificate verification.
- Volume/snapshot/object storage mã hóa at rest bằng key do hạ tầng quản lý.
- Fairness attribute mã hóa cấp field; DB chỉ lưu ciphertext và key version.
- Evidence file dùng object-level encryption; signed URL TTL ngắn.
- Backup cũng mã hóa, access log và tách account khỏi production runtime.

### 5.2. Secret

- `DATABASE_URL`, SMTP/API keys và encryption keys nằm trong secret manager.
- Không lưu secret ở `governance.model_releases.configuration`, raw payload, audit metadata hoặc outbox payload.
- Rotate credential theo environment; thu hồi ngay khi nhân sự/service không còn nhu cầu.
- Migration role và break-glass role không được ứng dụng sử dụng.

### 5.3. Password và token

- Password hash theo chính sách security đã benchmark; default target là Argon2id.
- Encoded hash chứa version/parameter/salt; field `salt` riêng chỉ tồn tại trong giai đoạn chuyển đổi legacy.
- Session/reset token dùng random đủ entropy; DB lưu hash.
- Token comparison constant-time ở application.
- Token hết hạn/revoked được purge định kỳ; audit chỉ lưu action/outcome.

## 6. Retention đề xuất

Các mốc dưới đây là baseline kỹ thuật để sizing. Legal/privacy owner phải phê duyệt trước production và cấu hình có thể ngắn hơn theo nguồn/thị trường.

| Dữ liệu | Baseline đề xuất | Trigger xóa/ẩn danh | Ghi chú |
|---|---:|---|---|
| Auth session | Hết hạn + 30 ngày | TTL job | Có thể giữ fingerprint hash ngắn hạn cho security |
| One-time token | Hết hạn + 7 ngày | TTL job | Không giữ token plaintext |
| Raw source record | Theo `data_sources.retention_days`, tối đa baseline 30 ngày | `purge_after` | Điều khoản nguồn ưu tiên |
| Rejected/quarantined raw error detail | 30–90 ngày | DQ close + TTL | Redact PII trong error |
| Normalized job version | Theo license, baseline 24 tháng sau hết hạn | retention job | Aggregate có thể giữ lâu hơn nếu hợp pháp |
| Published market signal | 5 năm | archive policy | Không chứa PII; giữ lineage/source stats |
| Profile snapshot recommendation | 180 ngày hoặc đến khi run audit hết hạn | `expires_at` | Có thể rút ngắn; run còn metadata/hash |
| Evidence file | Khi learner xóa/account purge hoặc hết mục đích | DSR/object lifecycle | Metadata được redact nếu link lịch sử cần tồn tại |
| Withdrawn consent record | Theo legal accountability, baseline 5 năm | legal retention | Lưu quyết định tối thiểu, không giữ content thừa |
| Share grant | 2 năm sau hết hiệu lực | retention job | Phục vụ dispute/audit; scope không chứa content |
| Counseling note | Baseline 2 năm sau relationship ended | policy/DSR | Cần policy riêng cho minor |
| Audit event | Baseline 2 năm; security event critical 5 năm | partition drop/archive | Metadata tối thiểu, không full PII |
| Fairness attribute row | Tối đa 180 ngày | `expires_at`/withdraw | Aggregate phải đạt k-anonymity policy |
| Fairness aggregate metric | 3–5 năm | governance archive | Không giữ cohort quá chi tiết |
| Outbox processed | 30 ngày | TTL job | Dead letter 90 ngày hoặc đến khi resolved |
| DSR export object | 7 ngày sau hoàn thành | object lifecycle | Signed URL riêng, audit download |

Retention job phải chạy idempotent, ghi số row/object xử lý và cảnh báo backlog. Không dùng cascade delete rộng mà chưa dry-run exact target.

## 7. Quy trình delete/anonymize dữ liệu cá nhân

### 7.1. Các bước

1. Nhận DSR, xác minh identity và khóa scope.
2. Chuyển user sang `deletion_pending`, revoke session/token/share grant.
3. Dừng job recommendation/counseling mới và đánh dấu outbox liên quan.
4. Tạo manifest các row/object theo user id; review legal hold.
5. Xóa object evidence/export trước, lưu receipt kỹ thuật không chứa filename nhạy cảm.
6. Xóa hoặc redact profile, evidence, observation, feedback, roadmap, counseling theo policy.
7. Recompute/redact output dẫn xuất không còn căn cứ được phép giữ.
8. Xóa email/credential/account khi dependency cho phép; audit user FK có thể trở thành null.
9. Giữ consent/audit/DSR tối thiểu nếu có lawful retention; pseudonymize subject reference khi cần.
10. Chạy invariant và orphan check; hoàn thành DSR kèm report.

### 7.2. Legal hold

Legal hold phải có bảng/cấu hình được duyệt trước khi production. Nếu hold chặn xóa, DSR chuyển `partially_completed`, ghi rõ nhóm dữ liệu, căn cứ và thời điểm review; không âm thầm giữ lại.

## 8. Chỉ mục và query pattern

### 8.1. Nguyên tắc

- Index phục vụ query đã biết; không index mọi FK/column một cách máy móc.
- Partial index cho current/active/open/pending giảm kích thước và phù hợp hot path.
- Index text fuzzy dùng `pg_trgm`; full-text job content dùng `tsvector` GIN.
- Query PII luôn bắt đầu bằng owner key để RLS và B-tree hiệu quả.
- Kiểm tra `EXPLAIN (ANALYZE, BUFFERS)` với dữ liệu gần production trước release.

### 8.2. Hot path và index đã có

| Hot path | Index/thiết kế |
|---|---|
| Login theo email | unique `iam.user_emails(email_normalized)` |
| Session active của user | partial `(user_id, expires_at)` where not revoked |
| Consent mới nhất | `(user_id, purpose_code, recorded_at desc)` |
| Grant theo owner/recipient | partial owner/recipient + `valid_until` where active |
| Tìm nghề/skill alias | B-tree normalized + trigram GIN |
| Observation mới nhất | `(learner_user_id, skill_id, observed_at desc)` partial non-retracted |
| Evidence của learner | `(learner_user_id, evidence_type, occurred_on desc)` partial non-deleted |
| Current job version | partial unique `(job_posting_id)` where current |
| Search job text | GIN `search_vector` |
| Salary observed | partial salary index where current+advertised |
| Signal nghề/skill theo vùng/thời gian | `(occupation_id/location_id/window_end desc)` và skill tương đương |
| Current learning content | partial unique current; active dates index |
| Run mới nhất learner | `(learner_user_id, created_at desc)` |
| Option theo run/rank | unique `(recommendation_run_id, display_rank)` |
| Roadmap của learner | `(learner_user_id, status, updated_at desc)` |
| Progress mới nhất | `(milestone_id, occurred_at desc)` |
| Audit theo subject/resource | subject/actor/resource + time desc |
| Outbox dispatch | partial `(available_at, created_at)` pending/failed |

### 8.3. Index review

Mỗi tháng hoặc sau tăng dữ liệu lớn:

- kiểm tra `pg_stat_user_indexes.idx_scan`;
- phát hiện index chưa dùng nhưng xét cả maintenance/unique enforcement;
- kiểm tra duplicate/overlapping index;
- xem bloat và write amplification;
- xem slow query theo `pg_stat_statements`;
- chỉ drop index sau một chu kỳ quan sát và migration rollback plan.

## 9. Partition và capacity

### 9.1. Không partition sớm

Reference DDL để bảng thường nhằm giảm phức tạp MVP. Chuyển range partition theo tháng khi một trong các điều kiện xảy ra:

- bảng vượt khoảng 20–50 triệu row;
- bảng/index vượt khoảng 50–100 GB;
- retention delete tạo vacuum/bloat đáng kể;
- query luôn lọc theo thời gian và partition pruning có lợi;
- backup/maintenance window không đạt SLA.

Ứng viên đầu tiên:

1. `market.raw_records` theo `received_at`;
2. `governance.audit_events` theo `occurred_at`;
3. `roadmap.progress_events` theo `occurred_at` nếu usage cao;
4. `governance.outbox_events` theo `created_at` khi event volume lớn;
5. `market.job_posting_versions` theo `captured_at` chỉ sau khi đánh giá FK/query.

### 9.2. Sizing giả định để lập kế hoạch

| Metric sau pilot/scale | Giả định tham khảo | Bảng ảnh hưởng |
|---|---:|---|
| Learner | 100.000 | IAM/profile/privacy |
| Evidence/learner | 10 | evidence: 1 triệu row + object storage |
| Skill observations/learner | 50 | 5 triệu row |
| Recommendation runs/learner/năm | 12 | 1,2 triệu run; options/link lớn hơn 10–50 lần |
| Job posting nhận/năm | 10 triệu | raw/posting/version |
| Skill mentions/job | 10 | 100 triệu mention |
| Audit events/user/tháng | 50 | 60 triệu/năm ở 100.000 user |

Đây không phải cam kết traffic. Sau pilot phải thay bằng metric thật trước khi chọn instance/partition/read replica.

## 10. Autovacuum, statistics và maintenance

- Bật autovacuum; không disable trên bảng ingestion/event.
- Bảng nhiều update như session/outbox có thể cần autovacuum threshold/scale factor riêng sau đo đạc.
- Tăng statistics target có chọn lọc cho status, source, occupation, skill, location và các dimension lệch.
- Chạy `ANALYZE` sau backfill lớn trước cutover.
- `VACUUM FULL` là thao tác lock mạnh; không dùng thường kỳ.
- Dùng `REINDEX CONCURRENTLY`/index build concurrently theo kế hoạch production, không gộp vào transaction migration thông thường nếu công cụ không hỗ trợ.
- Theo dõi transaction lâu, xmin cũ, replication lag và temp file.

## 11. Backup, PITR và restore

### 11.1. Baseline đề xuất cho MVP production

- RPO: không quá 15 phút.
- RTO: không quá 4 giờ.
- PITR bằng WAL archive/managed backup.
- Full snapshot hằng ngày; giữ daily 14 ngày, weekly 8 tuần, monthly theo legal/budget.
- Backup mã hóa và đặt ở failure domain/account khác production.
- Object storage evidence có versioning/lifecycle tương thích RPO.

### 11.2. Restore drill

Ít nhất hằng tháng và trước go-live lớn:

1. Restore database vào environment cô lập.
2. Restore object manifest mẫu.
3. Chạy migration checksum/schema diff.
4. Chạy FK/orphan/invariant query.
5. Kiểm tra login test, recommendation lineage và roadmap.
6. Đo thời gian đạt service-ready.
7. Ghi report RPO/RTO thực tế và remediation.

Backup chưa từng restore thành công không được coi là backup đã kiểm chứng.

## 12. Monitoring và alert

| Nhóm | Metric/điều kiện cảnh báo |
|---|---|
| Availability | connection failure, health check, failover event |
| Capacity | CPU, memory, storage, IOPS, connection utilization, WAL growth |
| Query | p95/p99 latency, lock wait, deadlock, statement timeout, temp bytes |
| Replication | replica/WAL archive lag, failed archive |
| Maintenance | autovacuum lag, dead tuple ratio, table/index bloat |
| Data pipeline | ingestion queued/failed, source freshness, raw purge backlog |
| Outbox | oldest pending age, retry/dead-letter count |
| Privacy | expired grant still status active, DSR overdue, fairness purge backlog |
| Recommendation | failed run rate, incomplete option invariant, stale model/taxonomy |
| Governance | error invariant > 0, critical issue open, audit insert failure |

Audit insert failure trong luồng nhạy cảm phải fail closed hoặc vào durable fallback đã được security duyệt; không im lặng bỏ audit.

## 13. Kế hoạch migration từ schema hiện tại

### 13.1. Mapping nguồn → đích

| `public.users` hiện tại | Đích | Xử lý |
|---|---|---|
| `id` | `iam.users.id`, `profile.learner_profiles.user_id` | Giữ nguyên UUID để không phá reference |
| `full_name` | `iam.users.full_name` | Trim; hàng rỗng vào quarantine |
| `email` | `iam.user_emails.email` | Normalize bằng generated column; phát hiện duplicate trước backfill |
| `password_hash` + `salt` | `iam.password_credentials.password_hash` | Đóng gói đúng format legacy đã xác minh hoặc temporary legacy columns; rehash khi login |
| `birth_year` | `profile.learner_profiles.birth_year` | Validate range; không tự suy learner stage |
| `birth_month` | `profile.learner_profiles.birth_month` | Validate 1–12 |

### 13.2. Nguyên tắc migration password legacy

Không nối chuỗi salt/hash tùy ý rồi tuyên bố là Argon2id. Trước migration phải xác nhận:

- thuật toán;
- số vòng/parameter;
- encoding salt/hash;
- cách compare hiện tại;
- test vector với account thử.

Hai phương án an toàn:

1. Chuyển sang encoded legacy format mà auth service hiểu; sau login thành công rehash bằng thuật toán mới.
2. Giữ temporary legacy credential table/columns trong giai đoạn chuyển đổi; xóa sau khi mọi account rehash hoặc reset bắt buộc.

Nếu không xác định được thuật toán, buộc reset password; không hạ chuẩn hash.

### 13.3. Các phase expand–contract

#### Phase 0 — Readiness

- Freeze quyết định schema/version.
- Backup và restore drill.
- Đếm row, duplicate normalized email, invalid birth, null/blank, hash format.
- Xác nhận app hiện có thực sự ghi/đọc `public.users` ở đâu.
- Xác nhận downtime budget và rollback owner.

#### Phase 1 — Expand

- Tạo schema/domain/table foundation qua Drizzle migration đã review.
- Chưa đổi đường đọc hiện tại.
- Tạo database roles và test quyền trên environment không production.
- Bổ sung telemetry dual-write/backfill.

#### Phase 2 — Backfill

- Backfill theo batch khóa bằng `id`, commit nhỏ.
- Giữ nguyên UUID.
- Tạo `iam.users`, primary email, credential legacy, learner role, learner profile.
- Email chưa có bằng chứng verify giữ `verified_at = NULL`; product/security quyết định account status grandfathered.
- Hàng lỗi vào bảng/report quarantine tạm thời, không bỏ qua.
- Sau mỗi batch so count, checksum logic và sample login.

#### Phase 3 — Dual write

- Ghi cả schema cũ và mới trong một transaction hoặc qua outbox có reconciliation.
- Ưu tiên source-of-truth rõ ràng; không dual-write vô thời hạn.
- Monitor mismatch count phải về 0 trước cutover.

#### Phase 4 — Shadow read

- Đọc schema mới cho traffic nội bộ/canary, so response với schema cũ.
- Test signup/login/reset/email uniqueness, RLS user A/B và pool reuse.
- Chạy invariant/constraint/orphan checks.

#### Phase 5 — Cutover

- Chuyển read sang `iam/profile`.
- Bật auth session/token mới.
- Theo dõi error/latency/login success/reset flow.
- Giữ write tương thích cũ trong rollback window ngắn đã định.

#### Phase 6 — Contract

- Dừng dual-write sau sign-off.
- Chuyển `public.users` read-only; archive snapshot.
- Chỉ drop bảng/cột legacy ở migration riêng sau ít nhất một release ổn định và xác nhận rollback không cần.
- Xóa temporary legacy salt/credential khi đã rehash/reset đủ account.

### 13.4. Reconciliation bắt buộc

```sql
-- Count identity rows.
SELECT
  (SELECT count(*) FROM public.users) AS legacy_users,
  (SELECT count(*) FROM iam.users) AS target_users,
  (SELECT count(*) FROM profile.learner_profiles) AS learner_profiles;

-- Detect missing target identities.
SELECT u.id
FROM public.users u
LEFT JOIN iam.users iu ON iu.id = u.id
WHERE iu.id IS NULL;

-- Detect normalized email collisions before unique enforcement/cutover.
SELECT lower(btrim(email)) AS normalized_email, count(*)
FROM public.users
GROUP BY lower(btrim(email))
HAVING count(*) > 1;

-- Validate migrated birth fields.
SELECT user_id, birth_month, birth_year
FROM profile.learner_profiles
WHERE (birth_month IS NULL) <> (birth_year IS NULL)
   OR birth_month NOT BETWEEN 1 AND 12
   OR birth_year NOT BETWEEN 1900 AND 2100;
```

Các query trên dùng trong runbook có kiểm soát; query đầu chỉ chạy khi `public.users` vẫn còn.

### 13.5. Rollback

- Trước contract, feature flag chuyển read về legacy.
- Dual-write log/outbox cho phép replay target→legacy trong rollback window nếu format tương thích.
- Không rollback bằng cách drop target schema.
- Giữ migration forward-fix cho constraint/index; destructive rollback cần backup restore plan.
- Sau contract, rollback là restore/PITR hoặc migration forward; không giả định bảng cũ còn authoritative.

## 14. Chuyển target DDL sang Drizzle

Không đưa 81 bảng vào một thay đổi. Triển khai theo vertical slice:

1. IAM + consent + profile foundation.
2. Taxonomy + evidence/skill.
3. Market ingestion + signal.
4. Learning content.
5. Recommendation lineage.
6. Roadmap.
7. Sharing + counseling.
8. Governance/fairness/optimization.

Mỗi slice phải có:

- Drizzle schema với explicit PostgreSQL schema;
- generated SQL được review, không chỉ review TypeScript;
- forward migration và rollback/forward-fix plan;
- backfill riêng nếu có dữ liệu;
- constraint/index/RLS integration tests;
- cập nhật ERD/data dictionary;
- kiểm tra migration trên snapshot gần production;
- release flag và observability.

SQL target sử dụng capability PostgreSQL cụ thể như generated column, partial unique index, RLS, security-invoker view và domain. Nếu Drizzle không mô tả đầy đủ một capability, giữ raw SQL migration có comment; không làm yếu constraint chỉ để ORM thuận tiện.

## 15. Quy trình deploy database

### 15.1. Trước deploy

- Backup/PITR healthy.
- Migration chạy trên database clone.
- Xem lock level, table rewrite, disk/WAL estimate.
- `statement_timeout`/`lock_timeout` phù hợp.
- Schema diff đúng phạm vi.
- Không có transaction dài/batch đang chạy xung đột.
- Rollback owner và communication channel sẵn sàng.

### 15.2. Trong deploy

- Chạy migration non-interactive bằng migration role.
- Ghi migration version/checksum/start/end.
- Dừng khi một file transaction fail; không bỏ qua statement.
- Backfill theo batch riêng, có checkpoint và rate limit.
- Index concurrently chạy ngoài transaction nếu cần production availability.

### 15.3. Sau deploy

- Chạy structural verification.
- Chạy `governance.validate_business_invariants()`.
- Chạy smoke test login/RLS/source ingestion/recommendation/roadmap tương ứng slice.
- Kiểm tra error, lock, replication lag, WAL/storage và slow query.
- Cập nhật runbook/schema docs trong cùng release.

## 16. Security test bắt buộc

| Test | Kết quả mong đợi |
|---|---|
| User A query profile B | 0 row/permission denied |
| Counselor role không grant | 0 row |
| Counselor có `profile.summary` | Đọc summary; không evidence/education |
| Grant expired/revoked | Mất access tức thì |
| Counselor read-only update roadmap | RLS denied |
| Recommendation worker query fairness table | Permission denied |
| Market worker query profile/credential | Permission denied |
| App update/delete audit event | Permission denied |
| Pool reuse A→B | B không thấy dữ liệu A |
| SQL injection vào current user setting | UUID parsing/parameterization từ chối |
| Object key evidence từ user khác | Service/RLS ownership check từ chối |
| DSR export URL hết TTL | Access denied và audit outcome |

## 17. Danh sách kiểm tra go-live

- [ ] Product/legal phê duyệt consent, minor, retention và source license.
- [ ] Security phê duyệt role, RLS, hash, encryption, secret rotation và break-glass.
- [ ] Mọi runtime login role là NOSUPERUSER/NOBYPASSRLS.
- [ ] RLS integration tests qua connection pool thành công.
- [ ] Migration/backfill rehearsal trên clone thành công.
- [ ] Password legacy có test vector hoặc kế hoạch reset bắt buộc.
- [ ] Backup restore drill đạt RPO/RTO.
- [ ] Object storage lifecycle/malware scan hoạt động.
- [ ] Raw/audit/outbox retention job và alert hoạt động.
- [ ] `governance.validate_business_invariants()` không có error.
- [ ] Dashboard freshness, ingestion, outbox, DSR, audit và DB capacity có alert.
- [ ] Incident runbook xác định owner cho privacy, security, data quality và AI bias.
- [ ] Không có secret/raw token/password trong log, audit, model config hoặc outbox.
- [ ] Schema, DDL, Drizzle migration, ERD và data dictionary cùng phiên bản.

## 18. Tài liệu PostgreSQL 18 tham chiếu

- [Row Security Policies](https://www.postgresql.org/docs/18/ddl-rowsecurity.html)
- [GRANT](https://www.postgresql.org/docs/18/sql-grant.html)
- [CREATE VIEW và tùy chọn view](https://www.postgresql.org/docs/18/sql-createview.html)
- [Unique Indexes](https://www.postgresql.org/docs/18/indexes-unique.html)
- [Indexes on Expressions](https://www.postgresql.org/docs/18/indexes-expressional.html)
- [Partial Indexes](https://www.postgresql.org/docs/18/indexes-partial.html)
