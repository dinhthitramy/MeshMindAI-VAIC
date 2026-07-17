# Kiến trúc và quyết định thiết kế cơ sở dữ liệu

## 1. Tóm tắt điều hành

MeshMind AI không chỉ là một web tài khoản và bài trắc nghiệm. Dữ liệu cốt lõi hình thành một chuỗi bằng chứng có thể truy ngược:

```text
Nguồn hợp pháp
  → bản ghi thô có thời hạn lưu
  → tin tuyển dụng/cơ hội học tập được chuẩn hóa và phiên bản hóa
  → nghề, kỹ năng, lương, vùng và chất lượng
  → tín hiệu thị trường có cỡ mẫu/phương pháp/độ tin cậy
  → snapshot hồ sơ người học
  → phiên model + taxonomy + mốc dữ liệu
  → nhiều lựa chọn nghề với lý do, khoảng trống, đánh đổi và nguồn
  → roadmap có phiên bản, milestone, bằng chứng và tiến độ
```

Thiết kế dùng một PostgreSQL cluster với 11 schema nghiệp vụ và 81 bảng. Đây là modular monolith ở tầng dữ liệu: tách quyền và ownership theo miền nhưng vẫn giữ transaction/FK xuyên miền ở những nơi tính toàn vẹn quan trọng hơn khả năng tách service sớm.

## 2. Cơ sở đầu vào

Thiết kế được suy ra từ:

- code/runtime hiện tại: Next.js 16, Drizzle ORM, PostgreSQL 18, Redis 8;
- schema hiện tại: `public.users`;
- các luồng giao diện: signup, login, forgot/reset password, dashboard;
- đặc tả nghiệp vụ trong `docs/phan-tich-muc-tieu-pham-vi-tac-nhan-chuc-nang.md`;
- yêu cầu đạo đức: mở rộng lựa chọn, không dùng thuộc tính được bảo vệ để xếp hạng, giải thích được, có consent và audit.

## 3. Phạm vi thiết kế

### 3.1. Trong phạm vi

- tài khoản, email, credential, session và token một lần;
- vai trò ứng dụng;
- consent có phiên bản, chia sẻ theo scope/thời hạn, quan hệ người giám hộ và quyền chủ thể dữ liệu;
- danh mục nguồn, tổ chức, địa điểm;
- taxonomy nghề–kỹ năng có phiên bản, alias và quan hệ;
- hồ sơ người học, mục tiêu, ưu tiên, học vấn, bằng chứng và skill observation;
- ingestion dữ liệu tuyển dụng, version, mapping, dedup/quality và signal;
- cơ hội học tập có phiên bản, skill/occupation mapping và tài trợ công khai;
- registry phiên model;
- khuyến nghị đa chiều có lineage;
- roadmap có phiên bản, dependency, evidence requirement và progress event;
- quan hệ tư vấn, lịch hẹn, ghi chú và action item;
- audit, issue, data quality, fairness test và outbox;
- RLS, role và view “current state”.

### 3.2. Ngoài phạm vi thiết kế vật lý hiện tại

- data warehouse/lakehouse dài hạn;
- feature store hoặc vector database;
- cổng tuyển dụng và quy trình nộp hồ sơ;
- billing, marketplace hoặc thanh toán học phí;
- CRM của trường/đơn vị tư vấn;
- hệ thống thông báo đa kênh hoàn chỉnh;
- quản lý nội dung prompt ở dạng plaintext trong database nghiệp vụ;
- lưu binary file trực tiếp trong PostgreSQL.

Metadata file được lưu trong `profile.evidence_assets`; nội dung file phải nằm ở object storage mã hóa.

## 4. Các quyết định kiến trúc

| Mã | Quyết định | Lý do | Hệ quả |
|---|---|---|---|
| AD-01 | Một PostgreSQL cluster, nhiều schema nghiệp vụ | MVP cần FK/transaction xuyên miền và đội nhỏ dễ vận hành | Có thể tách service sau này qua outbox; chưa tối ưu độc lập từng workload |
| AD-02 | UUID cho business entity; `bigint identity` cho log/ingestion volume lớn | UUID an toàn khi tạo phân tán; identity tiết kiệm index cho event lớn | UUID hiện dùng `gen_random_uuid()` để tương thích Drizzle hiện tại |
| AD-03 | Mọi thời điểm dùng `timestamptz`, lưu UTC | Tránh sai lệch timezone | UI chuyển theo `iam.users.time_zone`; ngày lịch dùng `date` |
| AD-04 | Tiền dùng `numeric(19,4)` + ISO currency | Không dùng floating-point cho chi phí/lương | Không cộng/so sánh khác currency nếu chưa qua bảng tỷ giá được duyệt |
| AD-05 | Điểm/độ tin cậy dùng domain `catalog.score_01` | Cùng thang 0–1 và có constraint chung | UI phải phân biệt score, confidence và uncertainty |
| AD-06 | Năng lực chuẩn dùng thang 0–5 | Dễ ánh xạ rubric, không giả độ chính xác quá mức | Inference có thể giữ số thập phân ở trường phân tích khoảng trống |
| AD-07 | Dữ liệu gốc và dữ liệu suy luận luôn tách | Tránh biến ước tính thành quan sát | Salary `advertised`, `estimated`, `not_disclosed` là ba trạng thái khác nhau |
| AD-08 | Taxonomy/model/opportunity/job/profile đều có version hoặc snapshot | Tái tạo được một đề xuất lịch sử | Tăng storage; cần retention rõ ràng |
| AD-09 | Observation/event là nguồn sự thật; summary là projection | Giữ lịch sử và giải thích | `profile.skill_summaries` phải có job rebuild/idempotent |
| AD-10 | RLS làm lớp phòng thủ thứ hai | Dữ liệu người học và người chưa thành niên có rủi ro cao | Backend bắt buộc `SET LOCAL app.current_user_id` trong transaction |
| AD-11 | Chia sẻ là grant có scope, access level và expiry | Consent không đồng nghĩa chia sẻ toàn bộ hồ sơ | Chuyên viên không có quyền mặc định chỉ vì mang role counselor |
| AD-12 | Dữ liệu fairness tự nguyện nằm trong bảng cách ly, mã hóa | Không để thuộc tính được bảo vệ lọt vào ranking | Recommendation worker không được GRANT bảng này |
| AD-13 | JSONB chỉ dùng cho payload, metadata, cấu hình và snapshot | Cần linh hoạt ở rìa nhưng giữ core queryable | Thuộc tính cần lọc/join/ràng buộc phải thành cột/bảng |
| AD-14 | Raw payload có `purge_after` | Tuân thủ giấy phép/retention của nguồn | Pipeline phải không phụ thuộc raw data sau khi normalized |
| AD-15 | Không soft-delete mọi bảng | Soft-delete tràn lan làm FK/query khó hiểu | Master data dùng status; PII dùng workflow delete/anonymize; event giữ theo retention |
| AD-16 | Không dùng PostgreSQL enum cho trạng thái nghiệp vụ | Status có thể thay đổi trong pilot; enum migration khó rollback | Dùng `text` + named `CHECK`; thay đổi phải qua migration |
| AD-17 | Không đưa `pgvector` vào schema lõi | Compose hiện không cài extension; embedding là cache tái tạo được | Khi cần, tạo ADR và schema riêng, không trộn vector vào nguồn sự thật |
| AD-18 | Không đưa multi-tenancy vào MVP | Chưa có yêu cầu tổ chức sở hữu learner | Tổ chức chỉ là catalog; nếu B2B phải bổ sung tenant boundary trước dữ liệu thật |

## 5. Phân rã theo miền dữ liệu

| Schema | Số bảng | Ownership | Dữ liệu chính |
|---|---:|---|---|
| `catalog` | 3 | Platform/data governance | địa điểm, tổ chức, nguồn dữ liệu và điều khoản nguồn |
| `iam` | 7 | Identity/security | user, email, password credential, session, token, role |
| `privacy` | 8 | Privacy/security | policy, consent, share grant, guardian, DSR, fairness attribute cách ly |
| `taxonomy` | 9 | Data steward | release, nghề, kỹ năng, alias, task và quan hệ |
| `profile` | 12 | Người học | hồ sơ, mục tiêu, ưu tiên, học vấn, bằng chứng, skill observation/snapshot |
| `market` | 9 | Labor-market data | ingestion, raw record, job version, mapping, quality flag và signal |
| `learning` | 4 | Content steward | cơ hội học tập có phiên bản và mapping nghề/kỹ năng |
| `governance` | 7 | Platform/ethics/data governance | model release, DQ, audit, issue, fairness metric, outbox |
| `recommendation` | 9 | Recommendation service | run, option, dimension, reason, evidence/market/learning link, gap, feedback |
| `roadmap` | 8 | Người học/cộng tác được cấp quyền | plan/version/milestone/dependency/evidence/progress |
| `counseling` | 5 | Người học và chuyên viên theo grant | relationship, appointment, note, action item, review |

## 6. Quy ước mô hình vật lý

### 6.1. Tên

- schema, bảng, cột, index, constraint: `snake_case`;
- bảng số nhiều;
- PK: `id`, trừ bảng nối dùng composite PK;
- FK: `<entity>_id`; FK trực tiếp đến user là `<role>_user_id` để rõ ngữ nghĩa;
- thời điểm: `_at`; ngày lịch: `_on`; khoảng dữ liệu: `_start`/`_end`;
- boolean: `is_`, `has_`, hoặc mô tả rõ như `willing_to_relocate`;
- hash: chỉ rõ thuật toán nếu cần kiểm chứng, ví dụ `content_sha256`.

### 6.2. Nullability

`NULL` mang nghĩa “chưa biết/không áp dụng”, không mang nghĩa false, 0 hoặc chuỗi rỗng. Các cặp field phụ thuộc nhau có `CHECK`, ví dụ:

- có chi phí thì phải có currency;
- có salary observation thì phải có currency và period;
- status completed thì phải có `completed_at`;
- sponsored thì phải có disclosure;
- minor guardian verified thì phải có `verified_at`.

### 6.3. ID và khóa tự nhiên

- UUID là identity kỹ thuật, không hiển thị như mã nghiệp vụ.
- `code`, `(source_id, external_id)`, version number và normalized alias là candidate key có unique constraint.
- Email unique trên dạng `lower(btrim(email))`; không coi chữ hoa/thường là tài khoản khác.
- Không dùng email, tên nghề hoặc title tin tuyển dụng làm FK.

### 6.4. Chuỗi và kiểm tra định dạng

Không dùng `varchar(n)` đại trà. PostgreSQL `text` kết hợp `CHECK` trên `length(column_name)` thể hiện đúng giới hạn nghiệp vụ và tránh giới hạn kỹ thuật tùy tiện. URL chỉ được kiểm tra/chuẩn hóa ở application/service; database lưu chuỗi và kiểm soát nullability/lineage.

### 6.5. Mảng

Mảng chỉ dùng cho tập nhỏ, đóng và không cần metadata riêng, ví dụ `preferred_work_modes`. Quan hệ cần truy vấn, trọng số, thời gian hoặc nguồn phải dùng bảng nối.

## 7. Identity và authentication

### 7.1. Tách user và email

`iam.users` là account identity ổn định. `iam.user_emails` cho phép:

- đổi email mà không đổi user id;
- xác minh email riêng;
- một email primary tại một thời điểm;
- chặn hai tài khoản dùng cùng email sau normalize.

### 7.2. Password

`iam.password_credentials.password_hash` phải chứa encoded hash đầy đủ của thuật toán hiện đại; salt nằm trong encoded hash. Trường `salt` hiện tại không được tiếp tục như thiết kế dài hạn.

Yêu cầu ứng dụng:

- mặc định Argon2id hoặc thuật toán được security phê duyệt;
- rate-limit tại Redis/gateway và ghi failed count/lock ở DB;
- không log hash, token, password hoặc reset link;
- `one_time_tokens` chỉ lưu hash của token;
- session chỉ lưu hash của opaque token;
- xóa token hết hạn theo job định kỳ.

### 7.3. Application role và database role

`iam.roles` là vai trò nghiệp vụ của người dùng. Các role `meshmind_*` trong SQL là PostgreSQL group role. Hai khái niệm không thay thế nhau:

- database role quyết định service nào có thể chạm table;
- application role quyết định người dùng đang đăng nhập có nghiệp vụ gì;
- RLS dùng `app.current_user_id` và share grant, không tin role counselor một cách tuyệt đối.

## 8. Hồ sơ người học và bằng chứng

### 8.1. Ownership

`profile.learner_profiles.user_id` là owner boundary. Các bảng con mang `learner_user_id` hoặc truy ngược được qua FK. Mọi link từ recommendation/roadmap đến evidence phải cùng owner; invariant `DBR_REC_007` kiểm tra điều này.

### 8.2. Skill observation

Không lưu một field duy nhất như “SQL = 0,8”. Mỗi quan sát gồm:

- skill chuẩn;
- nguồn: tự đánh giá, evidence, mini-task, academic result, counselor hoặc inference;
- proficiency và confidence riêng;
- evidence/observer nếu có;
- thời điểm, expiry và trạng thái rút lại;
- metadata phương pháp.

`profile.skill_summaries` là projection phục vụ query nhanh, giữ riêng self/evidence/inferred level. Mọi summary phải rebuild được từ observation hợp lệ.

### 8.3. Profile snapshot

Mỗi recommendation run trỏ đến đúng `profile.profile_snapshots`. Snapshot:

- immutable theo quy ước service;
- có revision và SHA-256;
- có mục đích;
- có expiry;
- không chứa thuộc tính fairness cách ly;
- không nên chứa URL signed hoặc token tạm thời.

## 9. Taxonomy

### 9.1. Stable entity và release

`taxonomy.skills` và `taxonomy.occupations` giữ ID ổn định. Release ghi thời điểm entity được giới thiệu/retire. Bảng quan hệ/mapping mang `release_id` để tái tạo ngữ nghĩa tại thời điểm recommendation.

### 9.2. Alias

Alias giữ nguyên chuỗi nguồn và normalized form. Một alias có thể mơ hồ; vì vậy không unique toàn cục. Mapping confidence và source cho phép human review.

### 9.3. Quan hệ nghề

`occupation_relations` phân biệt adjacent, progression, specialization và career change. Đây là cơ sở tạo nhóm lựa chọn liền kề/vươn tới; không suy ra chỉ từ title giống nhau.

## 10. Thị trường lao động

### 10.1. Ba lớp dữ liệu

1. `raw_records`: payload ngắn hạn, phục vụ retry/audit kỹ thuật theo license.
2. `job_postings` + `job_posting_versions`: bản ghi chuẩn hóa có lịch sử.
3. `labor_market_signals`: aggregate đã đánh giá chất lượng và có thể công bố.

### 10.2. Dedup

Một nguồn/external id là một posting. Tin trùng xuyên nguồn được trỏ bằng `duplicate_of_posting_id`. Chỉ canonical, không quarantined mới vào view `market.current_job_posting_versions` và pipeline signal.

### 10.3. Salary

Không điền salary ước tính vào field advertised. `salary_disclosure` bắt buộc phân biệt:

- `advertised`: số xuất hiện trong tin;
- `estimated`: số do pipeline bổ sung và phải gắn nhãn;
- `not_disclosed`: không có số; các field salary bắt buộc null.

Signal lưu p25/p50/p75, sample size, currency, period, vùng, cửa sổ và freshness. Không dùng trung bình đơn lẻ làm con số chính.

### 10.4. “Thiếu hụt kỹ năng”

`shortage_classification` chỉ được low/moderate/high nếu `supply_sample_size > 0`. Khi chỉ có tin tuyển dụng, dùng “nhu cầu đăng tuyển” và trạng thái `insufficient_supply_data` hoặc `not_assessed`.

## 11. Cơ hội học tập

`learning.opportunities` là identity ổn định; `opportunity_versions` giữ nội dung cụ thể được review. Recommendation/roadmap trỏ đến version, không trỏ bản ghi mutable.

Mọi cơ hội tài trợ cần:

- `is_sponsored = true`;
- `sponsor_disclosure` không null;
- sponsorship không được dùng làm signal tăng relevance;
- relevance lấy từ skill/occupation mapping và điều kiện người học.

## 12. Recommendation và explainability

### 12.1. Reproducibility tuple

Một run tái tạo được bằng tuple:

```text
(profile_snapshot_id,
 model_release_id,
 taxonomy_release_id,
 market_data_as_of,
 input_sha256,
 run_configuration)
```

Nếu model bên ngoài không deterministic, tuple vẫn tái tạo được input, version và bằng chứng để audit; không cam kết byte-identical output.

### 12.2. Vector đa chiều

Mỗi career option có sáu dimension riêng:

1. `interest_values`;
2. `evidence_strength`;
3. `gap_learnability`;
4. `market_demand`;
5. `personal_feasibility`;
6. `data_uncertainty`.

`retrieval_score` là field nội bộ, không hiển thị như “điểm định mệnh”. Mỗi dimension có score tùy dữ liệu, confidence và explanation.

### 12.3. Lineage bắt buộc

Career option hoàn chỉnh phải có:

- reason: why fit, market evidence, tradeoff, uncertainty, exploration step;
- link đến evidence/skill observation;
- link đến published market signal;
- skill gap và validation action;
- learning route có version;
- disclaimer;
- category current fit/adjacent/stretch/exploration.

Các link không sao chép nội dung nguồn. Chúng giữ FK đến nguồn và explanation tại thời điểm run.

## 13. Roadmap và tư vấn

### 13.1. Plan và progress tách nhau

- `roadmap_versions`/`milestones` là kế hoạch có phiên bản.
- `progress_events` là dòng sự kiện tiến độ.
- Khi đổi kế hoạch, tạo version mới và dùng `supersedes_milestone_id` để nối milestone tương đương.
- Không ghi đè lịch sử tiến độ cũ.

### 13.2. Milestone quan sát được

Mỗi milestone published phải có:

- completion criteria;
- necessity: required/recommended/optional;
- skill hoặc evidence requirement;
- mốc thời gian/effort nếu biết;
- dependency cùng roadmap version.

### 13.3. Counselor access

Quan hệ tư vấn chỉ active khi:

- có share grant owner=learner, recipient=counselor;
- grant có scope phù hợp và chưa hết hạn/revoke;
- consent là quyết định granted cho mục đích chia sẻ;
- các truy cập vẫn qua RLS và audit.

## 14. Governance

### 14.1. Model registry

Mỗi phiên model lưu type, provider, model/version, prompt version, config, artifact hash, taxonomy release và workflow approval/activation/retire. Không lưu secret/API key trong `configuration`.

### 14.2. Audit

Audit event lưu ai, hành động, subject, resource, purpose, outcome, request/trace và metadata tối thiểu. Không lưu:

- password/token/hash credential;
- raw prompt chứa PII;
- nội dung full evidence;
- IP/user-agent thô khi hash đáp ứng mục đích;
- response payload đầy đủ.

### 14.3. Outbox

Mọi event cần gửi sang queue/notification được insert cùng transaction business vào `governance.outbox_events`. Dispatcher xử lý `FOR UPDATE SKIP LOCKED`, retry có backoff và đưa dead letter sau ngưỡng cấu hình.

## 15. Transaction boundary

| Luồng | Các ghi thay đổi phải cùng transaction |
|---|---|
| Signup | `iam.users`, primary email, credential, role learner, consent bắt buộc, outbox verify-email |
| Grant chia sẻ | consent check, `share_grants`, scopes, audit, outbox invite |
| Ingestion normalize | raw status, posting identity/version, mappings/flags, counters run |
| Publish taxonomy | release status, published metadata, outbox cache invalidation |
| Complete recommendation | run status, options, dimensions/reasons/links/gaps, invariant check, outbox |
| Publish roadmap version | version status, milestones/dependencies, update current version, audit |
| Record progress | progress event, evidence link nếu có, outbox/recalculation request |
| Data deletion request | request state, account state, purge/anonymize jobs, audit reference |

Không giữ DB transaction mở trong lúc gọi LLM, SMTP hoặc API nguồn. Quy trình dùng trạng thái queued/running rồi transaction ngắn để ghi kết quả.

## 16. Consistency: database, service và kiểm tra định kỳ

### 16.1. Database-enforced

- PK, FK, unique;
- range/format bằng `CHECK`;
- một current version bằng partial unique index;
- salary/currency/status timestamp consistency;
- RLS và GRANT;
- scope/access-level đóng;
- reference version không bị hard delete.

### 16.2. Service-enforced trong transaction

- current version thuộc đúng aggregate;
- owner của evidence/link giống owner recommendation;
- dependency không tạo cycle;
- update `profile_revision` bằng optimistic locking;
- không publish run khi thiếu cấu phần explainability;
- consent mới nhất còn hiệu lực trước khi chia sẻ;
- model/taxonomy đang ở trạng thái được phép.

### 16.3. Periodic invariant

`governance.validate_business_invariants()` phát hiện quy tắc xuyên nhiều bảng. Kết quả `error > 0` phải chặn release hoặc tạo incident; `warning > 0` vào hàng đợi data/product review.

## 17. Concurrency

- Profile update: dùng điều kiện `WHERE user_id = :user_id AND profile_revision = :expected_revision`, đồng thời tăng revision trong cùng lệnh `UPDATE`.
- Job version: lock posting row, chuyển current cũ thành false, insert version mới, tránh hai current.
- Roadmap publish: lock roadmap row; supersede published cũ; publish mới; cập nhật `current_version_id`.
- Recommendation refresh: dùng idempotency key ở `input_sha256`; không tạo run completed trùng cùng input nếu policy không yêu cầu.
- Outbox: worker claim bằng `FOR UPDATE SKIP LOCKED` trong batch nhỏ.
- Counter/cached summary: upsert có algorithm version và calculated timestamp; source event không bị ghi đè.

## 18. Phân loại dữ liệu

| Lớp | Ví dụ | Kiểm soát tối thiểu |
|---|---|---|
| C0 Public/reference | tên nghề, tên kỹ năng, published signal | read-only cho app; provenance/version |
| C1 Internal | ingestion metrics, model config không secret, DQ result | service role, audit thay đổi |
| C2 Personal | email, profile, mục tiêu, ưu tiên, progress | TLS, encryption at rest, RLS, audit, retention |
| C3 Sensitive personal | evidence file, support needs, counseling note, minor linkage | C2 + object encryption, malware scan, scope hẹp, access review |
| C4 Restricted fairness/auth | password hash, token hash, fairness attribute mã hóa | schema/table isolation, không xuất log, role chuyên biệt, key rotation |

## 19. Phân kỳ hiện thực

### 19.1. Foundation

- `catalog.*`;
- `iam.*`;
- `privacy.consent_purposes`, `policy_versions`, `consent_records`;
- `profile.learner_profiles`;
- taxonomy release, skill, occupation và alias cơ bản;
- audit event nền.

### 19.2. MVP

- share grant/scope và DSR;
- goal, preference, education, evidence, skill observation/summary/snapshot;
- market ingestion, job/version/mapping/skill/flag/signal;
- learning opportunity/version/mapping;
- model release và recommendation đầy đủ;
- roadmap/version/milestone/progress;
- issue report, DQ và outbox;
- RLS và invariant verification.

### 19.3. Pilot

- guardian relationship sau legal sign-off;
- counseling workflow;
- fairness attribute collection và test run;
- evidence verification sâu;
- automation partition/retention;
- scenario/counterfactual bổ sung bằng migration riêng.

### 19.4. Scale

- warehouse/BI đã khử định danh;
- partition event/raw lớn;
- read replica cho analytics;
- search/embedding cache riêng;
- tenant model nếu chuyển sang B2B;
- sharding chỉ khi metric thực tế chứng minh cần thiết.

## 20. Tiêu chí phê duyệt thiết kế

Thiết kế đủ điều kiện chuyển sang implementation khi:

1. Product xác nhận nhóm người học MVP, nhóm nghề, vùng và nguồn.
2. Legal/privacy phê duyệt consent purpose, minor flow và retention.
3. Security review threat model cho auth, RLS, object storage và database roles.
4. Data team xác nhận taxonomy release workflow, mapping confidence và signal methodology.
5. AI team xác nhận reproduction tuple và không sử dụng fairness attribute.
6. Backend chuyển một vertical slice sang Drizzle và test migration rollback/forward.
7. QA có fixture cho các invariant `DBR_*`.
8. DBA chạy toàn bộ reference SQL trên PostgreSQL 18 trống và restore drill trên bản backup kiểm thử.
