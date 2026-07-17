# Quy tắc nghiệp vụ và ma trận truy vết dữ liệu

## 1. Mục đích

Tài liệu này chuyển yêu cầu FN-A01–FN-J05 và các nguyên tắc đạo đức thành quy tắc dữ liệu có mã, nơi thực thi và tiêu chí kiểm thử. Một quy tắc có thể được bảo vệ ở nhiều lớp:

- DB: `CHECK`, `FK`, `UNIQUE`, RLS hoặc GRANT;
- TX: service kiểm tra trong cùng transaction;
- JOB: kiểm tra định kỳ bằng `governance.validate_business_invariants()`;
- APP: validation/UX/policy engine;
- GOV: quy trình người duyệt hoặc phê duyệt pháp lý/đạo đức.

## 2. Quy tắc tài khoản và xác thực

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-AUTH-01 | Một email normalized chỉ thuộc một account | `iam.user_emails` | DB UK | `Test@X.vn` và `test@x.vn` không thể thuộc hai user |
| BR-AUTH-02 | Mỗi user tối đa một email primary | `iam.user_emails` | Partial UK | Insert primary thứ hai thất bại |
| BR-AUTH-03 | Email chưa verify không đủ điều kiện active nếu policy yêu cầu | `iam.users`, `user_emails` | TX | Activate user không có primary verified bị từ chối |
| BR-AUTH-04 | Password chỉ lưu encoded hash, không lưu plaintext | `password_credentials` | APP/GOV | Log/DB scan không có password; hash đạt format/algorithm policy |
| BR-AUTH-05 | Token/session chỉ lưu hash | `auth_sessions`, `one_time_tokens` | APP | Token trong email/cookie không bằng giá trị DB |
| BR-AUTH-06 | One-time token phải đúng purpose, chưa dùng, chưa hết hạn | `one_time_tokens` | DB + TX | Replay token đã consumed thất bại |
| BR-AUTH-07 | Đổi/reset password revoke session theo security policy | credential/session/outbox | TX | Sau reset, session cũ không dùng được |
| BR-AUTH-08 | Failed login không tiết lộ account tồn tại | credential/audit | APP | Response cùng dạng cho email sai và password sai |
| BR-AUTH-09 | Application role có thời hạn/revoke không còn hiệu lực | `iam.user_roles` | helper function | Expired role không qua `has_active_role` |
| BR-AUTH-10 | User deletion đi qua workflow, không xóa trực tiếp từ UI | `users`, DSR, audit | TX/GOV | Account chuyển `deletion_pending`, có DSR và audit |

## 3. Consent, privacy và sharing

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-PRV-01 | Consent luôn gắn đúng policy version và purpose | `consent_records` | FK | Không insert policy/purpose không tồn tại |
| BR-PRV-02 | Consent history append-only | `consent_records` | GRANT | App role không update/delete record |
| BR-PRV-03 | Quyết định mới supersede record cũ nhưng không xóa lịch sử | `supersedes_record_id` | TX | Withdraw tạo row mới, view current trả withdrawn |
| BR-PRV-04 | Share grant chỉ do owner tạo | `share_grants` | RLS | Recipient không thể cấp scope cho chính mình |
| BR-PRV-05 | Share grant phải dựa trên consent granted của đúng owner | consent/grant | JOB `DBR_PRV_001` + TX | Grant dùng consent user khác bị chặn/được phát hiện |
| BR-PRV-06 | Scope và access level nằm trong allowlist | `share_grant_scopes` | CHECK | Không insert scope tùy ý hoặc edit ngoài `roadmaps.edit` |
| BR-PRV-07 | Access mất ngay khi grant revoke/hết hạn | `has_active_share` | RLS | Cùng query trước/sau expiry cho kết quả khác |
| BR-PRV-08 | Role counselor không tự tạo quyền xem profile | role + share grant | RLS | Counselor không có grant nhận 0 row |
| BR-PRV-09 | Guardian relationship không tự động cấp toàn bộ dữ liệu | guardian + grant | RLS/TX | Verified guardian vẫn cần share grant/scope |
| BR-PRV-10 | Fairness attributes cần explicit consent và phải mã hóa | fairness response/consent | TX/GOV | Consent purpose khác bị từ chối; DB không có plaintext |
| BR-PRV-11 | Recommendation worker không được đọc fairness attributes | database GRANT | DB | Sau `SET ROLE meshmind_recommendation_worker`, truy vấn bảng fairness bị permission denied |
| BR-PRV-12 | DSR có due date, identity verification và trạng thái | `data_subject_requests` | DB/TX | Completed thiếu `completed_at` thất bại |
| BR-PRV-13 | Export object có TTL và không public | DSR result object | APP/GOV | Signed URL hết hạn; access được audit |
| BR-PRV-14 | Audit metadata không chứa raw PII/secret | `audit_events.metadata` | APP/GOV | DLP/log test không phát hiện token/password/evidence content |
| BR-PRV-15 | Minor flow chỉ bật sau cấu hình tuổi/pháp lý được duyệt | birth year/month, policy, guardian | APP/GOV | User trong ngưỡng áp đúng policy và actor relationship |

## 4. Hồ sơ, bằng chứng và skill

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-PRO-01 | Hồ sơ thuộc duy nhất một user | `learner_profiles.user_id` | PK/FK | Không có hai profile cùng user |
| BR-PRO-02 | Birth month/year là một cặp hoặc cùng null | learner profile | CHECK | Chỉ có month hoặc chỉ có year thất bại |
| BR-PRO-03 | Profile update dùng optimistic revision | `profile_revision` | TX | Hai update cùng revision chỉ một thành công |
| BR-PRO-04 | Người học có thể khai báo “chưa có” bằng cách không tạo evidence/result | profile | APP | Onboarding vẫn hoàn thành khi optional evidence trống |
| BR-PRO-05 | Preference giữ source/confidence/time | `learner_preferences` | DB/APP | Mỗi observation có đủ ba thuộc tính |
| BR-PRO-06 | Preference mới không xóa observation cũ | preference history | TX | View current đổi; history count tăng |
| BR-PRO-07 | Evidence tách metadata và file | evidence item/asset | DB/APP | DB không chứa binary; object key duy nhất |
| BR-PRO-08 | File chưa scan clean không được phục vụ | `malware_scan_status` | APP | Pending/infected không tạo download URL |
| BR-PRO-09 | Tự đánh giá và evidence không gộp thành cùng observation | skill observations | DB/APP | `source_type` phân biệt; evidence source có evidence FK |
| BR-PRO-10 | System inference có confidence và method detail | skill observations | APP | Inference thiếu model/method metadata không được publish summary |
| BR-PRO-11 | Skill summary rebuild được từ observation còn hiệu lực | observation/summary | JOB | Rebuild cho kết quả nằm trong tolerance đã duyệt |
| BR-PRO-12 | Snapshot gắn revision, hash, purpose và expiry | profile snapshots | DB | Snapshot không có expiry/hash bị từ chối |
| BR-PRO-13 | Snapshot recommendation không chứa fairness attribute | snapshot builder | APP/GOV | Schema allowlist test loại trường được bảo vệ |
| BR-PRO-14 | Xóa evidence làm redaction/recompute các output phụ thuộc | evidence/recommendation | TX/JOB | Sau DSR, link/output được redacted hoặc run đánh dấu không tái hiện đầy đủ |
| BR-PRO-15 | Counselor observation chỉ được tạo khi share grant cho phép | skill observation/share | RLS/TX | Counselor hết grant không insert được |

## 5. Taxonomy và nội dung

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-TAX-01 | Chỉ một taxonomy release active | `taxonomy.releases` | Partial UK | Activate release thứ hai khi chưa retire release cũ thất bại |
| BR-TAX-02 | Skill/occupation code không tái sử dụng cho nghĩa khác | master entity | GOV | Merge giữ entity cũ deprecated và tạo relation |
| BR-TAX-03 | Alias giữ source, release và confidence | alias tables | DB | Không có alias mapping thiếu release |
| BR-TAX-04 | Low-confidence mapping cần human review | job mapping/mention | TX/GOV | Confidence dưới threshold vào pending queue |
| BR-TAX-05 | Quan hệ không được self-reference | relation tables | CHECK | Source=target thất bại |
| BR-TAX-06 | Release đã active không được sửa in-place | taxonomy tables | GOV/DB privilege | Thay đổi tạo release mới |
| BR-TAX-07 | Occupation skill requirement nêu evidence basis | `occupation_skills` | NOT NULL/CHECK | Không có basis bị từ chối |
| BR-TAX-08 | Adjacent/stretch dùng relation của đúng release | occupation relations/run | TX | Run taxonomy V không dùng relation chỉ tồn tại ở V+1 |

## 6. Dữ liệu thị trường lao động

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-MKT-01 | Chỉ ingest nguồn active, purpose được phép | data source/run | TX/GOV | Paused/revoked source không tạo run thường |
| BR-MKT-02 | Raw record có hash và purge date | raw records | CHECK | `purge_after <= received_at` thất bại |
| BR-MKT-03 | Một source/external id là một posting identity | job postings | UK | Upsert tạo version, không tạo posting trùng |
| BR-MKT-04 | Content change tạo version mới | job versions | UK + TX | Hash cũ không tạo version mới; hash mới tăng version |
| BR-MKT-05 | Mỗi posting tối đa một version current | job versions | Partial UK | Hai `is_current=true` thất bại |
| BR-MKT-06 | Duplicate/quarantined/removed không vào view current dùng aggregate | current view | DB/view | Fixture duplicate không xuất hiện |
| BR-MKT-07 | Salary not disclosed có toàn bộ field tiền null | job version | CHECK | Gán salary cho not_disclosed thất bại |
| BR-MKT-08 | Salary advertised và estimated không bị trộn | `salary_disclosure` | DB/query | Aggregate observed lọc đúng advertised |
| BR-MKT-09 | Salary range và percentile có thứ tự hợp lệ | version/signal | CHECK | max<min hoặc p50<p25 thất bại |
| BR-MKT-10 | Mapping model/hybrid phải có model release | mappings/mentions | CHECK | model method thiếu FK thất bại |
| BR-MKT-11 | Rejected mapping không vào signal | review status | Pipeline | Recompute bỏ rejected rows |
| BR-MKT-12 | Quality flag high/critical ảnh hưởng trọng số hoặc quarantine theo policy | flags | Pipeline/GOV | Flag fixture không được tính như clean posting |
| BR-MKT-13 | Signal có window, as-of, freshness, methodology, confidence | signal | NOT NULL | Thiếu thuộc tính không insert được |
| BR-MKT-14 | Published signal phải có source contribution | signal source stats | JOB `DBR_MKT_002` | Warning count bằng số signal thiếu source row |
| BR-MKT-15 | Không gọi “thiếu hụt” khi không có supply sample | signal | CHECK/JOB `DBR_MKT_001` | high shortage với supply=0 thất bại |
| BR-MKT-16 | Small sample hạ confidence/không publish theo threshold cấu hình | signal | Pipeline/GOV | Dưới threshold không đạt confidence publish |
| BR-MKT-17 | Source contribution accepted count không vượt parent | signal stats | JOB `DBR_MKT_003` | Dữ liệu lệch tạo error invariant |

## 7. Cơ hội học tập

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-LRN-01 | Cơ hội có identity ổn định và version nội dung | opportunity/version | DB/TX | Update feed tạo version mới |
| BR-LRN-02 | Mỗi opportunity tối đa một current version | version | Partial UK | Current thứ hai thất bại |
| BR-LRN-03 | Cost có currency và range hợp lệ | version | CHECK | Cost thiếu currency thất bại |
| BR-LRN-04 | Sponsored content phải có disclosure | version | CHECK | Sponsored=true, disclosure null thất bại |
| BR-LRN-05 | Sponsorship không tăng relevance | recommendation link | APP/GOV | Pair test chỉ đổi sponsored không đổi relevance |
| BR-LRN-06 | Content stale/expired không được đề xuất như active không cảnh báo | verification/expiry | APP | UI/link có cảnh báo hoặc bị loại |
| BR-LRN-07 | Skill/occupation mapping nêu evidence basis/relevance | link tables | DB | Mapping thiếu evidence/relevance thất bại |
| BR-LRN-08 | Recommendation trỏ đúng opportunity version | option learning link | FK | Content đổi không làm giải thích lịch sử thay đổi |

## 8. Recommendation và explainability

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-REC-01 | Run gắn đúng learner snapshot | run/snapshot | JOB `DBR_REC_006` + TX | Cross-owner snapshot tạo violation |
| BR-REC-02 | Run ghi model, taxonomy, market cut-off và input hash | run | NOT NULL | Thiếu một trường không insert được |
| BR-REC-03 | Run completed có tối thiểu ba option ready | run/options | JOB `DBR_REC_001` + publish gate | Hai option không được complete |
| BR-REC-04 | Không hiển thị một điểm tổng duy nhất | dimensions/UI | APP | API trả sáu dimension; retrieval score không nằm DTO public |
| BR-REC-05 | Mỗi option ready có đúng sáu dimension | option dimensions | JOB `DBR_REC_002` | Thiếu/nhân đôi dimension bị phát hiện/UK chặn |
| BR-REC-06 | Mỗi option có why-fit, market, tradeoff, uncertainty, exploration step | reasons | JOB `DBR_REC_003` | Thiếu reason type chặn publish |
| BR-REC-07 | Option ready trỏ ít nhất một published market signal | market links | JOB `DBR_REC_004` | Link draft signal không thỏa |
| BR-REC-08 | Non-exploration option nên có ít nhất hai loại personal evidence | evidence links | JOB `DBR_REC_005` | Thiếu tạo warning và có thể chuyển exploration |
| BR-REC-09 | Evidence/observation phải thuộc đúng learner | evidence links | JOB `DBR_REC_007` | Cross-user link tạo error |
| BR-REC-10 | Gap không là rào cản vĩnh viễn; có validation/action | skill gap | APP/GOV | Required gap có cách kiểm chứng/bù |
| BR-REC-11 | Category gồm current fit/adjacent/stretch/exploration | career option | CHECK | Category ngoài allowlist thất bại |
| BR-REC-12 | Protected attributes không vào input ranking | snapshot/model contract | GOV/test | Pairwise protected-attribute change không đổi ranking |
| BR-REC-13 | Location chỉ dùng feasibility/opportunity, không suy diễn năng lực | dimensions/reasons | GOV/test | Explanation không gắn vùng với năng lực bẩm sinh |
| BR-REC-14 | Feedback chỉ do learner owner tạo | feedback/run | RLS + JOB `DBR_REC_008` | Counselor không giả feedback learner |
| BR-REC-15 | Not interested không xóa vĩnh viễn nghề khỏi exploration universe | feedback | APP | Run mới có thể đưa lại với lý do/thay đổi dữ liệu |
| BR-REC-16 | Disclaimer khẳng định quyết định thuộc người học | option | NOT NULL/APP | Option ready thiếu disclaimer không publish |
| BR-REC-17 | Run cũ không bị ghi đè khi hồ sơ/market/model đổi | run | APP | Refresh tạo run mới và latest view đổi |
| BR-REC-18 | Counterfactual là run riêng có trigger type | run | CHECK | Không sửa output run gốc |

## 9. Roadmap và tiến độ

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-RDM-01 | Roadmap thuộc learner và có thể gắn goal/option | roadmaps | FK/RLS | User khác không đọc/ghi nếu không có grant |
| BR-RDM-02 | Mỗi roadmap tối đa một published version | roadmap version | Partial UK | Publish version thứ hai khi chưa supersede thất bại |
| BR-RDM-03 | `current_version_id` thuộc cùng roadmap | roadmaps/version | TX + JOB `DBR_RDM_001` | Cross-roadmap pointer tạo error |
| BR-RDM-04 | Version AI phải ghi model release | roadmap version | CHECK | Authored_by=ai thiếu model thất bại |
| BR-RDM-05 | Milestone có completion criteria quan sát được | milestones | NOT NULL/CHECK | Chuỗi rỗng thất bại |
| BR-RDM-06 | Milestone phân biệt required/recommended/optional | milestone necessity | CHECK | Giá trị ngoài allowlist thất bại |
| BR-RDM-07 | Published milestone gắn skill hoặc evidence requirement | links | JOB `DBR_RDM_003` | Missing link tạo warning/chặn theo release gate |
| BR-RDM-08 | Dependency chỉ trong cùng roadmap version | dependencies | TX + JOB `DBR_RDM_002` | Cross-version edge tạo error |
| BR-RDM-09 | Dependency graph không cycle | dependencies | TX | A→B→A bị từ chối |
| BR-RDM-10 | Progress là event, không ghi đè history | progress events | APP | Mỗi update tăng row count; current view đổi |
| BR-RDM-11 | Completed luôn 100%; blocked có blocker | progress event | CHECK | Dữ liệu không nhất quán thất bại |
| BR-RDM-12 | Progress milestone phải thuộc roadmap ghi trên event | progress | JOB `DBR_RDM_004` | Cross-roadmap event tạo error |
| BR-RDM-13 | Revision giữ link milestone cũ qua supersedes | milestone | TX | Progress/history vẫn truy ngược được |
| BR-RDM-14 | Counselor edit cần scope `roadmaps.edit` access edit | RLS | DB | Chỉ `roadmaps` read không update được |
| BR-RDM-15 | Evidence review phân biệt submitted/accepted/change/rejected | evidence link | CHECK | Review status có timestamp phù hợp |

## 10. Counseling, governance và fairness

| Mã | Quy tắc | Dữ liệu | Thực thi | Tiêu chí kiểm thử |
|---|---|---|---|---|
| BR-GOV-01 | Counseling relationship khớp owner/recipient của counselor grant | relationship/share | JOB `DBR_PRV_002` + TX | Mismatch tạo error |
| BR-GOV-02 | Grant hết hạn làm access counseling mất ngay | RLS helper | DB | Counselor query trả 0 sau expiry dù relationship còn active |
| BR-GOV-03 | Ghi chú counselor-only vẫn phải thông báo việc lưu ghi chú | session notes | CHECK/APP | Counselor-only thiếu `learner_notified_at` thất bại |
| BR-GOV-04 | Note visibility được lọc theo participant | session notes | RLS | Learner không thấy counselor-only text |
| BR-GOV-05 | Potential bias review tạo/đính issue | review/issue | TX | Outcome potential_bias có issue id trong workflow |
| BR-GOV-06 | Model chỉ active sau approval | model release | CHECK/GOV | Active thiếu approved/activated timestamp thất bại |
| BR-GOV-07 | Paused/retired model không tạo run mới | model/run | TX | Worker reject non-active release |
| BR-GOV-08 | Critical issue có SLA/escalation | issue report | APP/GOV | Queue monitor cảnh báo quá hạn |
| BR-GOV-09 | Fairness run gắn model, taxonomy, suite version và scope | fairness run | NOT NULL | Không thiếu lineage |
| BR-GOV-10 | Metric có sample size và cohort definition; cohort nhỏ bị suppress | fairness metrics | DB/GOV | Sample dưới ngưỡng không xuất dashboard chi tiết |
| BR-GOV-11 | Fairness approval chỉ cho run passed | test run | CHECK | Failed/inconclusive không set approved_at |
| BR-GOV-12 | Audit event append-only với role thường | audit GRANT | DB | Update/delete bị permission denied |
| BR-GOV-13 | Outbox insert cùng transaction business | outbox | TX | Rollback business không để event mồ côi |
| BR-GOV-14 | Consumer event idempotent theo event id | outbox/consumer | APP | Retry không gửi email/tác vụ trùng |
| BR-GOV-15 | DQ failed severity error/critical chặn publish theo rule | DQ result | Pipeline/GOV | Publish gate reject entity có failure đang mở |

## 11. Ma trận truy vết chức năng → dữ liệu

| Nhóm yêu cầu | Bảng/view chính | Bảng hỗ trợ | Kiểm soát nổi bật |
|---|---|---|---|
| FN-A01 Onboarding | `learner_profiles`, `learner_goals` | preferences, locations | profile revision, optional fields |
| FN-A02 Consent | consent purposes/policies/records | guardian, audit | append-only, version, expiry |
| FN-A03 Hồ sơ/xuất/xóa | toàn bộ `profile.*`, DSR | evidence assets, audit | owner RLS, retention workflow |
| FN-A04 Chia sẻ | share grants/scopes | counseling relationship | scope/access/expiry RLS |
| FN-A05 Nhật ký truy cập | audit events | request/trace id | append-only, metadata tối thiểu |
| FN-A06 Người chưa thành niên | learner birth fields, guardian, minor policy | consent actor relationship | legal-configured flow |
| FN-B01 Tiếp nhận | data sources, ingestion runs, raw records | DQ/outbox | license, retention, counters |
| FN-B02 Làm sạch/dedup | job postings/versions/quality flags | current view | duplicate pointer, quality status |
| FN-B03 Chuẩn hóa nghề | aliases, job occupation mappings | model release, review | confidence + release |
| FN-B04 Trích xuất skill | job skill mentions | skills, model release | requirement type + raw phrase |
| FN-B05 Chuẩn hóa lương | job versions, labor signals | source stats | disclosure, range, percentile |
| FN-B06–B08 Signal/insight | labor signals/source stats | locations/taxonomy | method, sample, freshness, confidence |
| FN-B09 Chất lượng | job quality flags, DQ results | issue report | severity/work queue |
| FN-B10 Versioning | job versions, taxonomy/model release | recommendation run | immutable lineage tuple |
| FN-C01 Học vấn | education records/academic results | evidence | scale + verification |
| FN-C02 Hoạt động/chứng chỉ | evidence items/assets | organizations | evidence type + source |
| FN-C03–C04 Sở thích/test | learner preferences | preference dimensions | source/confidence/time |
| FN-C05 Mini-task | evidence item + skill observation | asset/rubric | evidence-specific observation |
| FN-C06 Tách tự đánh giá/evidence | skill observations/summaries | evidence | source-specific level |
| FN-C07 Hồ sơ động | observations/preferences/snapshots | audit | append/history + revision |
| FN-C08 Mâu thuẫn/thiếu | observations/summaries | issue/AI reason | confidence/uncertainty |
| FN-C09 Tóm tắt | profile snapshot/skill summary | evidence links | source-traceable summary |
| FN-D01 Tập lựa chọn | recommendation runs/options | occupation relations | category/rank/minimum three |
| FN-D02 Tuyến đào tạo | option learning links | opportunity versions | route type + version |
| FN-D03–D07 Đa chiều/giải thích | dimensions/reasons/evidence/market/gaps | preference/signal | six dimensions + lineage |
| FN-D08 Counterfactual | recommendation run | run configuration | trigger type riêng |
| FN-D09 So sánh | career options/dimensions/links | saved state ở client hoặc bổ sung sau | tiêu chí đồng nhất |
| FN-D10 Feedback | option feedback | run/owner | append/retract/RLS |
| FN-D11 Source/freshness | option market/learning links | signal/opportunity version | exact version/cut-off |
| FN-D12 Khám phá | exploration option/reason | learning opportunity type exploration | low-risk validation step |
| FN-E/F/G Roadmap | roadmaps/versions/milestones | skill/evidence/dependency/progress | living plan + observable criteria |
| FN-H01–H05 Counselor | counseling tables | share grant, roadmap, reviews | participant RLS + neutral options |
| FN-I01–I05 Anti-bias | isolated fairness data/test runs/metrics | model releases | no ranking grant, pairwise tests |
| FN-I06 Khiếu nại | issue reports | run/option/audit | trace model/evidence and resolution |
| FN-I07 Rollback model | model releases | recommendation run | pause/retire/version reference |
| FN-I08 Đánh giá định kỳ | fairness runs/metrics | DQ/audit | cohort/sample/approval |
| FN-I09 Thiếu dữ liệu | uncertainty dimension/reason | signal limitations | no fabricated values |
| FN-J01 Nguồn | data sources/ingestion | DQ | license/status/freshness |
| FN-J02 Taxonomy | releases/aliases/relations | mapping reviews | release + confidence |
| FN-J03 Hết hạn content | opportunity version | current view | expires/stale status |
| FN-J04 Tài trợ | opportunity version | option learning link | mandatory disclosure, no score boost |
| FN-J05 Model performance | model releases, DQ, fairness | issue reports | versioned metrics/workflow |

## 12. State transition hợp lệ

### 12.1. Recommendation run

```text
queued → running → completed
                 ↘ completed_with_warnings
                 ↘ failed
queued/running → cancelled
```

Không chuyển failed/completed trở lại running. Refresh tạo run mới.

### 12.2. Roadmap version

```text
draft → published → superseded
  └──→ rejected
```

Chỉ một version published/roadmap. Version mới được publish sau khi version cũ chuyển superseded trong cùng transaction.

### 12.3. Share grant

```text
pending → active → expired
             └──→ revoked
pending → rejected
```

Expiry có thể được job đánh dấu, nhưng RLS dùng timestamp trực tiếp nên access chấm dứt ngay cả khi status chưa được batch cập nhật.

### 12.4. Issue report

```text
submitted → triaged → investigating → resolved
                     └──────────────→ rejected
resolved/rejected → reopened → investigating
```

## 13. Invariant xuyên bảng

| Mã trong SQL | Mức | Nội dung | Release gate |
|---|---|---|---|
| `DBR_REC_001` | Error | Completed run có ít hơn ba option ready | Chặn |
| `DBR_REC_002` | Error | Option ready thiếu sáu dimension | Chặn |
| `DBR_REC_003` | Error | Option ready thiếu reason bắt buộc | Chặn |
| `DBR_REC_004` | Error | Option ready không có published market signal | Chặn |
| `DBR_REC_005` | Warning | Non-exploration option thiếu hai loại evidence | Review/chuyển exploration |
| `DBR_REC_006` | Error | Run và snapshot khác learner | Chặn/incident |
| `DBR_REC_007` | Error | Evidence link khác learner | Chặn/security incident |
| `DBR_REC_008` | Error | Feedback không do owner | Chặn/security incident |
| `DBR_REC_009` | Error | Link trỏ reason thuộc option khác | Chặn |
| `DBR_REC_010` | Error | Taxonomy của run khác taxonomy model khai báo | Chặn |
| `DBR_MKT_001` | Error | Shortage không có supply evidence | Chặn publish |
| `DBR_MKT_002` | Warning | Signal publish thiếu source stats | Review/chặn theo policy |
| `DBR_MKT_003` | Error | Source accepted count vượt parent count | Chặn |
| `DBR_RDM_001` | Error | Current version khác roadmap | Chặn |
| `DBR_RDM_002` | Error | Dependency qua hai version | Chặn |
| `DBR_RDM_003` | Warning | Published milestone không có skill/evidence anchor | Review/chặn MVP |
| `DBR_RDM_004` | Error | Progress milestone không thuộc roadmap | Chặn |
| `DBR_RDM_005` | Error | Evidence milestone khác owner roadmap | Chặn/security incident |
| `DBR_RDM_006` | Error | Milestone supersede qua roadmap khác | Chặn |
| `DBR_PRV_001` | Error | Share grant dùng consent sai owner/decision | Thu hồi access/incident |
| `DBR_PRV_002` | Error | Counseling relationship sai grant participant/type | Thu hồi access/incident |
| `DBR_PRV_003` | Error | Active share dùng consent hết hạn/sai purpose | Thu hồi access/incident |
| `DBR_PRV_004` | Error | Relationship type của grant không khớp consent purpose | Thu hồi access/incident |

Lệnh kiểm tra:

```sql
SELECT rule_code, severity, violation_count, detail
FROM governance.validate_business_invariants()
WHERE violation_count > 0
ORDER BY CASE severity WHEN 'error' THEN 1 ELSE 2 END, rule_code;
```

## 14. Bộ ca kiểm thử dữ liệu tối thiểu

| ID | Given | When | Then |
|---|---|---|---|
| DB-AT-01 | Hai user | Gán email chỉ khác hoa/thường | Insert thứ hai vi phạm unique |
| DB-AT-02 | User có consent granted | Tạo counselor grant đúng scope | Counselor đọc đúng scope, không đọc evidence nếu chưa grant |
| DB-AT-03 | Grant active | Đưa `valid_until` về quá khứ | Counselor mất access ngay |
| DB-AT-04 | Fairness row tồn tại | Query dưới recommendation worker | Permission denied |
| DB-AT-05 | Evidence asset pending scan | Xin download URL | Service từ chối |
| DB-AT-06 | Hai skill observations khác source | Rebuild summary | Self/evidence level vẫn tách |
| DB-AT-07 | Posting current | Ingest content hash mới | Version tăng, chỉ version mới current |
| DB-AT-08 | Duplicate posting | Query current view | Duplicate không xuất hiện |
| DB-AT-09 | Job không công khai lương | Insert salary amount | Check constraint thất bại |
| DB-AT-10 | Signal không có supply sample | Set shortage high | Check constraint thất bại |
| DB-AT-11 | Sponsored opportunity | Bỏ disclosure | Check constraint thất bại |
| DB-AT-12 | Run có hai options | Complete và chạy invariant | `DBR_REC_001=1` |
| DB-AT-13 | Option thiếu uncertainty dimension | Publish/run invariant | `DBR_REC_002>0` |
| DB-AT-14 | Option link evidence user khác | Chạy invariant | `DBR_REC_007>0` |
| DB-AT-15 | Chỉ thay fairness attribute trong pair | Chạy recommendation test | Option/rank tương đương trong tolerance |
| DB-AT-16 | Option current-fit | Không có market link | `DBR_REC_004>0` |
| DB-AT-17 | Roadmap version A/B | Dependency milestone A→B | Transaction từ chối hoặc `DBR_RDM_002>0` |
| DB-AT-18 | Milestone 60% | Ghi status completed | Check constraint thất bại |
| DB-AT-19 | Milestone blocked | Không ghi blocker | Check constraint thất bại |
| DB-AT-20 | Counselor có read-only roadmap | Update roadmap | RLS từ chối |
| DB-AT-21 | Counselor có `roadmaps.edit` | Tạo draft version | Thành công và audit có actor/purpose |
| DB-AT-22 | Counselor-only note | Không set notified timestamp | Check constraint thất bại |
| DB-AT-23 | Share grant dùng consent learner khác | Chạy invariant | `DBR_PRV_001>0` |
| DB-AT-24 | DSR delete completed | Chạy purge workflow | PII bị xóa/anonymize; audit còn reference tối thiểu |
| DB-AT-25 | Outbox dispatcher retry cùng event | Consumer nhận hai lần | Chỉ một side effect nhờ idempotency key |

## 15. Definition of Done dữ liệu cho một đề xuất nghề

Một `career_options.state='ready'` chỉ được trả cho UI khi:

- run ở trạng thái completed/completed-with-warnings;
- run có profile snapshot, model release, taxonomy release và market cut-off;
- toàn run có ít nhất ba option ready;
- option có đủ sáu dimension;
- có why-fit, market evidence, tradeoff, uncertainty và exploration step;
- có published signal với source/window/sample/confidence;
- có evidence lineage hoặc được phân loại exploration vì bằng chứng yếu;
- mọi evidence thuộc đúng learner;
- có gap và hành động bù/kiểm chứng phù hợp;
- có route học cụ thể khi dữ liệu cho phép và route trỏ đúng content version;
- có disclaimer;
- invariant không có error;
- safety/fairness/policy gate không đánh dấu withheld.
