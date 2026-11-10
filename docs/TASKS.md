# Kế hoạch triển khai

Trạng thái hiện tại là chờ Product Owner duyệt planning. Thứ tự dưới đây phản ánh phụ thuộc và chưa gắn ngày cam kết.

| Mốc | Công việc | Điều kiện hoàn thành |
|---|---|---|
| M1 — Nền tảng và nguồn mẫu | Sau phê duyệt, dựng Next.js, Auth, cấu hình môi trường local và CI. Tạo schema nền và policy cho danh mục. Chốt người duyệt, nguồn mẫu có quyền dùng, model và ngân sách thử nghiệm. | Luồng đăng nhập chạy local. Hai tài khoản và anon qua kiểm thử quyền cơ bản. Mẫu nội dung được duyệt. Chốt quy mô MVP, bộ ca và ngưỡng mở thử nghiệm Tutor. |
| M2 — Học và quiz | Triển khai danh mục, quiz, chấm giao dịch và tiến độ. | Người học đi từ danh mục đến kết quả. Test đề sai, retry đồng thời và cách ly kết quả đạt. |
| M3 — Tutor | Nhập corpus, truy xuất và cung cấp lookup cùng conversation qua API chung. | Test nhập lại, thu hồi, thiếu căn cứ, lỗi phụ thuộc và bộ đánh giá đạt ngưỡng. |
| M4 — PWA và nghiệm thu | Hoàn thiện manifest, offline fallback, responsive và kiểm thử xuyên suốt. Chuẩn bị hướng dẫn vận hành và rollback. | Qua checklist PRD trên thiết bị mục tiêu. Product Owner duyệt riêng trước khi deploy hoặc chạy migration production. |

## M1 — Công việc được phép sau khi Product Owner duyệt

Owner là vai trò chịu trách nhiệm. Phạm vi triển khai giới hạn ở local và CI kiểm thử.

| ID | Phụ thuộc | Owner | Công việc và nghiệm thu |
|---|---|---|---|
| M1-01 | Phê duyệt M1 | Tech Lead | Khởi tạo Next.js, TypeScript và cấu hình mẫu. Build local thành công, tài liệu khởi động đủ và không chứa secret. |
| M1-02 | M1-01 | DevOps | CI chạy lint, typecheck và test. Bước lỗi làm job thất bại. CI không có job deploy. |
| M1-03 | M1-01 | Backend | Auth Supabase local qua email. Đăng nhập, khôi phục phiên và đăng xuất thành công. API thiếu phiên trả 401. |
| M1-04 | M1-03 | Backend | Soạn và áp dụng schema danh mục cùng RLS trên DB local. Test anon, hai tài khoản và vai trò biên tập. Xác nhận cấm ghi từ client, cấm đọc bản draft, và nguồn withdrawn làm entry biến mất dù entry vẫn published. |
| M1-05 | Phê duyệt M1 | Phụ trách nội dung | Bàn giao ít nhất 10 mục từ và 5 câu mẫu có quyền sử dụng, locator và dấu vết duyệt để test local. |
| M1-06 | M1-05 | Kỹ sư AI | Chuẩn bị bộ ca và rubric đủ phân nhóm theo RAG_DESIGN, có người duyệt xác nhận. Ghi đề xuất model, chiều vector, đơn giá, quota và ngân sách. |
| M1-07 | M1-02, M1-04, M1-06 | Product Owner | Rà soát bằng chứng nghiệm thu, chốt quy mô, người dùng, trình duyệt, model, giới hạn, ngân sách và ngưỡng RAG. Ghi quyết định trước khi chuyển mốc. |

Chỉ thực hiện các task trên sau khi M1 được duyệt. Quiz RPC và tích hợp Tutor thuộc các mốc sau. Deploy hoặc migration production cần phê duyệt riêng.

## Quyết định cần chốt

- Chỉ định người duyệt nội dung và xác nhận quyền sử dụng nguồn.
- Chọn LLM và embedding sau khi đánh giá chất lượng tiếng Việt, kích thước vector, chi phí và điều khoản dữ liệu.
- Chốt trình duyệt, đối tượng học thử và tiêu chí đo Tutor trước khi mở thử nghiệm.

## Rủi ro

- Nguồn ít hoặc chậm duyệt có thể chặn Tutor. M1 xác nhận quyền dùng và độ phủ mẫu trước khi cam kết M3.
- Trích dẫn hợp lệ vẫn có thể đi kèm diễn giải sai. Người duyệt đánh giá nghĩa và ngữ cảnh, nhất là biến thể và hội thoại.
- Policy hoặc hàm đặc quyền cấu hình sai có thể lộ dữ liệu hoặc đáp án. Kiểm tra từ góc nhìn hai tài khoản, anon và RPC.
- Độ trễ và chi phí nhà cung cấp có thể tăng khi hội thoại dài. Giới hạn ngữ cảnh và yêu cầu, đo trên corpus mẫu.
