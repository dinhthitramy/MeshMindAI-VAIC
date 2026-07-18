# CareerLens Product Roadmap

## Những Gì Đã Có

- [x] Đăng ký, đăng nhập, phân quyền và quản lý phiên.
- [x] AI chat hướng nghiệp có lưu hội thoại.
- [x] Form thu thập năng lực, sở thích và điều kiện cá nhân.
- [x] Tạo ba hướng nghề nghiệp có giải thích.
- [x] Phân tích skill gap và roadmap ba giai đoạn.
- [x] Market seed phủ 34 tỉnh, thành và 20 nhóm ngành.
- [x] Lọc dữ liệu nhạy cảm trước khi gửi tới LLM.
- [x] Landing page song ngữ, responsive, light/dark mode.

## P0: Hoàn Thiện MVP Cốt Lõi

- [ ] Tạo bảng hồ sơ hướng nghiệp dài hạn cho người học.
- [ ] Lưu kết quả mỗi lần phân tích CareerLens.
- [ ] Cho phép mở lại và so sánh các lộ trình đã tạo.
- [ ] Lưu hướng nghề nghiệp người dùng đã chọn hoặc đang cân nhắc.
- [ ] Lưu `memory_update` sau khi người dùng xác nhận.
- [ ] Cho phép cập nhật hồ sơ mà không phải nhập lại toàn bộ form.
- [ ] Tạo trang tổng quan hành trình nghề nghiệp.
- [ ] Phân biệt rõ dữ liệu thật, dữ liệu seed và dữ liệu dự báo.
- [ ] Thêm nguồn dẫn có cấu trúc cho mọi bằng chứng thị trường.
- [ ] Thêm trạng thái "Đang thử", "Đang cân nhắc", "Đã loại" cho từng hướng nghề.

## P1: Đánh Giá Năng Lực

- [ ] Xây dựng ngân hàng câu hỏi assessment.
- [ ] Đánh giá sở thích nghề nghiệp theo RIASEC hoặc mô hình tương đương.
- [ ] Đánh giá năng lực giải quyết vấn đề.
- [ ] Đánh giá giao tiếp, hợp tác và kỹ năng xã hội.
- [ ] Đánh giá phong cách học và động lực.
- [ ] Sử dụng câu hỏi tình huống thay vì chỉ tự chấm điểm.
- [ ] Lưu lịch sử kết quả assessment.
- [ ] Cho phép kết quả thay đổi theo thời gian.
- [ ] Giải thích ý nghĩa từng kết quả bằng ngôn ngữ dễ hiểu.
- [ ] Không dùng assessment như phán quyết nghề nghiệp cuối cùng.

## P2: Theo Dõi Phát Triển

- [ ] Chuyển roadmap thành các milestone có thể đánh dấu hoàn thành.
- [ ] Cho phép thêm dự án, hoạt động, chứng chỉ và trải nghiệm.
- [ ] Lưu bằng chứng như liên kết, tài liệu hoặc portfolio.
- [ ] Theo dõi mức độ tiến bộ của từng kỹ năng.
- [ ] Tự động điều chỉnh độ ưu tiên kỹ năng sau mỗi check-in.
- [ ] Tạo timeline từ THPT đến công việc đầu tiên.
- [ ] Nhắc người dùng check-in định kỳ.
- [ ] Hiển thị kỹ năng đã tiến bộ, đang chậm và chưa bắt đầu.
- [ ] Cho phép đổi hướng mà không mất dữ liệu cũ.
- [ ] Tạo báo cáo phát triển theo tháng, học kỳ hoặc năm.

## P3: Agent Thị Trường Realtime

- [ ] Kiểm tra model FPT nào hỗ trợ function calling.
- [ ] Tích hợp FPT Responses API.
- [ ] Xây agent orchestrator có giới hạn số lần gọi tool.
- [ ] Tạo tool `search_web`.
- [ ] Tạo tool `read_pages`.
- [ ] Tích hợp Tavily Search cho tìm kiếm realtime.
- [ ] Tích hợp Tavily Extract hoặc Firecrawl để đọc nội dung.
- [ ] Tạo domain policy cho từng website.
- [ ] Chặn website cần đăng nhập, CAPTCHA hoặc cấm scraping.
- [ ] Chống SSRF và URL redirect nguy hiểm.
- [ ] Chống prompt injection từ nội dung website.
- [ ] Cache kết quả tìm kiếm ngắn hạn bằng Redis.
- [ ] Hiển thị trạng thái "Đang tìm", "Đang đọc nguồn", "Đang tổng hợp".
- [ ] Gắn URL, ngày xuất bản và thời điểm truy cập vào câu trả lời.
- [ ] Kiểm tra citation có thực sự hỗ trợ nhận định của AI.
- [ ] Không cho AI tự tạo URL hoặc số liệu.

## P4: Agent Quét Nền

- [ ] Tạo danh sách chủ đề nghề nghiệp cần theo dõi.
- [ ] Xây worker chạy độc lập với Next.js.
- [ ] Tạo systemd timer chạy mỗi ba ngày.
- [ ] Phát hiện nội dung mới bằng URL và content hash.
- [ ] So sánh snapshot mới với dữ liệu lần trước.
- [ ] Phát hiện kỹ năng mới xuất hiện trong tin tuyển dụng.
- [ ] Phát hiện nghề hoặc ngành có tín hiệu thay đổi.
- [ ] Gửi cảnh báo khi có thay đổi liên quan đến hồ sơ người dùng.
- [ ] Lưu lịch sử mỗi lần agent chạy.
- [ ] Có retry, timeout và distributed lock.
- [ ] Theo dõi chi phí search, scrape và token LLM.

## P5: Dữ Liệu Việc Làm

- [ ] Tạo schema chuẩn cho tin tuyển dụng.
- [ ] Thu thập tin từ nguồn có API hoặc giấy phép rõ ràng.
- [ ] Cho phép doanh nghiệp đăng tin trực tiếp.
- [ ] Chuẩn hóa tên nghề, kỹ năng và địa phương.
- [ ] Loại bỏ tin trùng lặp.
- [ ] Phát hiện tin hết hạn.
- [ ] Phát hiện tin giả hoặc yêu cầu ứng viên đóng phí.
- [ ] Ánh xạ tin tuyển dụng với O*NET, ESCO hoặc ISCO.
- [ ] Phân tích kỹ năng xuất hiện theo ngành và địa phương.
- [ ] Hiển thị ngày cập nhật và nguồn của mỗi tin.
- [ ] Không scrape LinkedIn, TopCV hoặc VietnamWorks khi chưa được cấp phép.

## P6: Dự Báo Xu Hướng

- [ ] Kết hợp tín hiệu từ tuyển dụng, báo cáo và nguồn thống kê.
- [ ] Phân biệt dữ liệu quan sát, ước tính và dự báo.
- [ ] Tạo ba trạng thái: tăng, ổn định và chưa đủ dữ liệu.
- [ ] Hiển thị phạm vi Việt Nam, ASEAN, Hoa Kỳ, EU hoặc toàn cầu.
- [ ] Hiển thị mức tin cậy thấp, trung bình hoặc cao.
- [ ] Giải thích các nguồn dẫn đến dự báo.
- [ ] Không hiển thị phần trăm chính xác nếu chưa có backtest.
- [ ] Lưu snapshot để kiểm tra lại dự báo sau 3-5 năm.
- [ ] Xây bộ đánh giá độ chính xác của mô hình dự báo.

## P7: CV Và Portfolio

- [ ] Cho phép tải CV PDF hoặc DOCX.
- [ ] Trích xuất nội dung CV thành dữ liệu có cấu trúc.
- [ ] Tạo trình soạn thảo CV.
- [ ] Hỗ trợ nhiều phiên bản CV.
- [ ] Đánh giá độ rõ ràng và bằng chứng trong CV.
- [ ] Phát hiện mô tả chung chung hoặc thiếu kết quả.
- [ ] So sánh CV với mô tả công việc.
- [ ] Gợi ý nội dung cần ưu tiên, không nhồi từ khóa.
- [ ] Gợi ý dự án để bổ sung skill gap.
- [ ] Xuất CV sang PDF.
- [ ] Tạo portfolio từ dự án và milestone đã hoàn thành.
- [ ] Không gửi dữ liệu CV vào web search.

## P8: Chuyên Viên Hướng Nghiệp

- [ ] Thêm role chuyên viên tư vấn.
- [ ] Cho phép học sinh mời chuyên viên vào hồ sơ.
- [ ] Yêu cầu sự đồng ý trước khi chia sẻ dữ liệu.
- [ ] Tạo dashboard quản lý học sinh.
- [ ] Cho phép chuyên viên ghi chú riêng.
- [ ] Cho phép chuyên viên phản hồi lộ trình AI.
- [ ] Hiển thị những trường hợp cần hỗ trợ trực tiếp.
- [ ] Tạo lịch hẹn tư vấn.
- [ ] Lưu lịch sử thay đổi và người thực hiện.
- [ ] Không cho AI thay thế quyết định của chuyên viên.

## P9: Phụ Huynh Và Nhà Trường

- [ ] Tạo chế độ phụ huynh có quyền xem giới hạn.
- [ ] Xây cơ chế đồng ý cho người dùng chưa thành niên.
- [ ] Tạo dashboard lớp hoặc nhóm học sinh.
- [ ] Hiển thị skill gap tổng hợp, không lộ dữ liệu nhạy cảm.
- [ ] Xuất báo cáo phục vụ hoạt động hướng nghiệp.
- [ ] Cho phép giáo viên tổ chức assessment theo đợt.
- [ ] Tạo chương trình trải nghiệm nghề nghiệp.
- [ ] Đo lường mức độ tham gia và hoàn thành.

## P10: An Toàn Và Chất Lượng

- [ ] Bổ sung Zod validation cho chat API.
- [ ] Kiểm tra model theo allow-list trên server.
- [ ] Sửa chat lấy đúng 20 tin nhắn gần nhất.
- [ ] Sửa SSE parser để xử lý JSON bị chia giữa các chunk.
- [ ] Dừng upstream request khi người dùng bấm dừng.
- [ ] Bảo vệ endpoint AI logs bằng quyền admin.
- [ ] Thêm rate limit cho chat, search và scrape.
- [ ] Kiểm tra prompt injection, jailbreak và dữ liệu độc hại.
- [ ] Ẩn thông tin cá nhân khỏi log và tracing.
- [ ] Thêm chức năng tải xuống và xóa dữ liệu cá nhân.
- [ ] Xây bộ AI evaluation cho tính đúng, nguồn dẫn và thiên kiến.
- [ ] Thêm Playwright E2E cho các luồng quan trọng.
- [ ] Thêm accessibility và visual regression testing.
- [ ] Theo dõi token, latency, lỗi và chi phí theo từng tính năng.

## Thứ Tự Nên Làm

1. Lưu hồ sơ, lộ trình và quyết định của người học.
2. Chuyển roadmap thành milestone có thể theo dõi.
3. Xây assessment khách quan.
4. Thêm nguồn dẫn và agent tìm kiếm realtime.
5. Thêm agent quét nền mỗi ba ngày.
6. Xây CV review và portfolio.
7. Mở dashboard cho chuyên viên hướng nghiệp.
8. Tích hợp dữ liệu tuyển dụng được cấp phép.
9. Xây dự báo có backtest.
10. Mở rộng cho trường học, phụ huynh và doanh nghiệp.

> Không nên xây cổng doanh nghiệp hoặc hệ thống dự báo phức tạp trước khi hoàn thiện hồ sơ dài hạn, roadmap tracking và nguồn dẫn thị trường. Ba phần này là lõi tạo nên giá trị khác biệt của CareerLens.
