# Bộ tài liệu thiết kế cơ sở dữ liệu MeshMind AI

## 1. Mục đích

Bộ tài liệu này đặc tả cơ sở dữ liệu PostgreSQL mục tiêu cho MeshMind AI — hệ thống hỗ trợ người học khám phá nghề nghiệp, so sánh lộ trình đào tạo và thực hiện roadmap dựa trên bằng chứng cá nhân cùng tín hiệu thị trường lao động.

Thiết kế trả lời đồng thời bốn nhu cầu:

1. Đội sản phẩm/BA biết mỗi yêu cầu nghiệp vụ được lưu ở đâu và được kiểm soát bằng quy tắc nào.
2. Đội backend có schema, khóa, trạng thái, chỉ mục và ranh giới transaction rõ ràng để hiện thực bằng Drizzle ORM.
3. Đội data/AI có lineage từ dữ liệu nguồn đến tín hiệu, phiên model, đề xuất và phần giải thích.
4. Đội security/operations có mô hình consent, chia sẻ theo scope, RLS, retention, audit, backup và migration.

## 2. Hiện trạng và trạng thái tài liệu

### 2.1. Hiện trạng repo tại thời điểm khảo sát

- PostgreSQL 18 được cấu hình trong `compose.yml`.
- Drizzle ORM quản lý schema tại `lib/db/schema.ts` và migration tại `drizzle/`.
- Runtime hiện chỉ có bảng `public.users` với các trường tài khoản cơ bản.
- Luồng signup/login/reset password mới là giao diện; xác thực chưa được nối vào backend.
- Tài liệu nghiệp vụ hiện có tại `docs/phan-tich-muc-tieu-pham-vi-tac-nhan-chuc-nang.md` mô tả phạm vi sản phẩm rộng hơn đáng kể so với schema runtime.

### 2.2. Trạng thái bộ thiết kế

Đây là **target-state design**, không phải migration đã được phép chạy trên môi trường đang có dữ liệu. Các file SQL là migration tham chiếu greenfield để:

- xác nhận mô hình vật lý;
- chuyển thành Drizzle schema/migration theo từng epic;
- chạy trên database trống để review constraint, index và RLS;
- làm chuẩn đối chiếu khi triển khai từng giai đoạn.

Không chạy trực tiếp toàn bộ bộ SQL lên database hiện tại trước khi hoàn thành quy trình expand–migrate–verify–contract trong tài liệu vận hành.

## 3. Danh mục tài liệu

| Tài liệu | Đối tượng chính | Nội dung |
|---|---|---|
| [01-kien-truc-va-quyet-dinh-thiet-ke.md](./01-kien-truc-va-quyet-dinh-thiet-ke.md) | BA, architect, backend, data | Phạm vi, giả định, bounded context, quy ước dữ liệu, versioning, consistency và phân kỳ |
| [02-erd.md](./02-erd.md) | BA, backend, data | ERD theo miền và lineage xuyên suốt từ nguồn đến roadmap |
| [03-tu-dien-du-lieu.md](./03-tu-dien-du-lieu.md) | BA, backend, QA, data | Danh mục đầy đủ 81 bảng, mục đích, khóa, dữ liệu trọng yếu, lifecycle và phân loại bảo mật |
| [04-quy-tac-nghiep-vu-va-truy-vet.md](./04-quy-tac-nghiep-vu-va-truy-vet.md) | BA, QA, AI/data | Quy tắc nghiệp vụ, ma trận truy vết FN-A–FN-J, invariant xuyên bảng và ca kiểm thử |
| [05-bao-mat-van-hanh-va-migration.md](./05-bao-mat-van-hanh-va-migration.md) | Backend, DBA, DevOps, security | RLS, quyền, retention, index, partition, backup/restore, monitoring và kế hoạch chuyển đổi từ `public.users` |
| [postgresql/001_foundation_iam_privacy.sql](./postgresql/001_foundation_iam_privacy.sql) | Backend, DBA | Schema nền, domain dùng chung, catalog, IAM, consent và privacy |
| [postgresql/002_taxonomy_profile.sql](./postgresql/002_taxonomy_profile.sql) | Backend, data | Taxonomy nghề–kỹ năng, hồ sơ, bằng chứng và skill observation |
| [postgresql/003_market_learning_governance.sql](./postgresql/003_market_learning_governance.sql) | Data, backend | Ingestion, tin tuyển dụng, tín hiệu thị trường, cơ hội học tập và model registry |
| [postgresql/004_recommendation_roadmap_counseling.sql](./postgresql/004_recommendation_roadmap_counseling.sql) | Backend, AI/data | Khuyến nghị có giải thích, roadmap, tư vấn, audit và fairness test |
| [postgresql/005_security_rls.sql](./postgresql/005_security_rls.sql) | DBA, security, backend | Database roles, GRANT, helper function và Row-Level Security |
| [postgresql/006_views_and_verification.sql](./postgresql/006_views_and_verification.sql) | Backend, QA, DBA | View hiện hành, kiểm tra cấu trúc và hàm phát hiện vi phạm nghiệp vụ xuyên bảng |

## 4. Thứ tự đọc đề xuất

### Product/BA

1. Tài liệu kiến trúc và quyết định thiết kế.
2. ERD.
3. Quy tắc nghiệp vụ và truy vết.
4. Từ điển dữ liệu theo các epic cần triển khai.

### Backend/data

1. README này và tài liệu kiến trúc.
2. Toàn bộ SQL theo đúng thứ tự `001` đến `006`.
3. Từ điển dữ liệu và tài liệu vận hành.
4. Chuyển từng lát dọc đã duyệt sang Drizzle; không chép toàn bộ target-state vào một migration duy nhất.

### Security/DBA

1. Tài liệu bảo mật, vận hành và migration.
2. `001` để xác nhận PII/consent boundary.
3. `005` để threat-model database role và RLS.
4. `006` để xác nhận các invariant không thể biểu diễn bằng `CHECK`/`FK`.

## 5. Thứ tự áp dụng trên database kiểm thử trống

```text
001_foundation_iam_privacy.sql
        ↓
002_taxonomy_profile.sql
        ↓
003_market_learning_governance.sql
        ↓
004_recommendation_roadmap_counseling.sql
        ↓
005_security_rls.sql
        ↓
006_views_and_verification.sql
```

Điều kiện thực thi:

- PostgreSQL 18;
- tài khoản migration có quyền tạo schema và extension `pg_trgm`;
- file `005` cần tài khoản có quyền `CREATEROLE`;
- database trống, không có các schema đích;
- mọi file phải chạy thành công trọn transaction;
- sau khi nạp seed/test data, truy vấn `governance.validate_business_invariants()` không được trả về dòng `error` có `violation_count > 0`.

## 6. Nguồn sự thật và cách xử lý xung đột

Thứ tự ưu tiên khi các tài liệu chưa đồng bộ:

1. Quyết định sản phẩm/pháp lý đã được phê duyệt.
2. Quy tắc nghiệp vụ trong `04-quy-tac-nghiep-vu-va-truy-vet.md`.
3. DDL PostgreSQL trong `postgresql/`.
4. Từ điển dữ liệu và ERD.
5. Code Drizzle/runtime hiện hành.

Nếu DDL và Drizzle khác nhau, chưa được tự động coi DDL target-state là schema production. Phải tạo ADR/migration cụ thể, xác nhận tương thích dữ liệu và cập nhật cả hai phía trong cùng pull request.

## 7. Phạm vi triển khai đề xuất

| Giai đoạn | Trọng tâm dữ liệu | Kết quả cần đạt |
|---|---|---|
| Foundation | IAM, consent, profile cơ bản, taxonomy nền | Có tài khoản an toàn, consent có phiên bản, hồ sơ có quyền sở hữu và danh mục nghề–kỹ năng ổn định |
| MVP | Ingestion có nguồn, bằng chứng/skill, signal, recommendation, roadmap, sharing/audit | Tạo được ít nhất ba lựa chọn có giải thích và roadmap có truy nguyên |
| Pilot | Tư vấn, kiểm chứng evidence, progress, data quality/fairness workflow | Chạy thử với người học/chuyên viên và đo chất lượng theo cohort |
| Scale | Partition, aggregate nâng cao, mô phỏng, ecosystem source | Mở rộng dữ liệu/nghề/khu vực mà vẫn giữ lineage, RLS và khả năng tái tạo |

## 8. Các điểm cần product/legal chốt trước production

1. Ngưỡng tuổi và cơ chế xác minh người giám hộ áp dụng tại thị trường phát hành.
2. Thời hạn lưu từng loại PII, raw job payload, audit log và snapshot.
3. Nguồn tuyển dụng/đào tạo nào được phép lưu nội dung gốc, trong bao lâu và cho mục đích nào.
4. Rubric xác minh chương trình, chứng chỉ, dự án và bằng chứng do người học tải lên.
5. SLA xử lý yêu cầu truy cập/xuất/xóa dữ liệu và khiếu nại thiên lệch.
6. Các cohort được phép dùng cho fairness audit và ngưỡng cỡ mẫu tối thiểu để tránh tái định danh.
7. RPO/RTO production theo cam kết dịch vụ và ngân sách hạ tầng.

Các điểm trên không làm schema mất hiệu lực; chúng quyết định cấu hình retention, workflow, quyền và ngưỡng kiểm soát trước khi go-live.
