# Quy tắc cho Coding Agents

## Cổng phê duyệt

Bản planning đã được review ở trạng thái APPROVED WITH CHANGES. Chỉ chỉnh tài liệu cho đến khi Product Owner phê duyệt bản cập nhật và cho phép bắt đầu M1. Sau đó chỉ thực hiện các task M1 trong [kế hoạch](docs/TASKS.md) trên local và CI kiểm thử. Deploy và migration production cần phê duyệt riêng. Kiểm tra đúng môi trường trước khi chạy lệnh có tác động dữ liệu.

## Phạm vi và cấu trúc

- Đọc [PRD](docs/PRD.md) và [milestone](docs/TASKS.md) trước khi nhận việc. Đối chiếu [kiến trúc](docs/ARCHITECTURE.md), [schema](docs/DATABASE.md) và [RAG](docs/RAG_DESIGN.md) khi sửa mô-đun liên quan.
- Thực hiện từng lát cắt nhỏ, giữ modular monolith và ưu tiên KISS, DRY, YAGNI. Đề xuất thay đổi phạm vi hoặc hợp đồng trước khi thực hiện. Microservices nằm ngoài kiến trúc. Việc thêm LangChain hoặc LangGraph cần lý do kỹ thuật và duyệt kiến trúc.
- Dùng Zod ở biên dữ liệu. Giữ secret phía máy chủ và chỉ đưa tên biến hoặc giá trị giả vào tệp mẫu. Kiểm tra phiên và quyền ở API lẫn PostgreSQL. Dùng RLS và cấp quyền hàm tối thiểu.

## Nội dung và kiểm thử

- Chỉ dùng nội dung tiếng Huế đã được duyệt, có nguồn và quyền sử dụng. Fixture kỹ thuật có thể dùng chuỗi đánh dấu trung tính. Mọi ví dụ tiếng Huế phải lấy từ nguồn đã duyệt.
- Với thay đổi nghiệp vụ, xác định tiêu chí nghiệm thu trước khi sửa. Chạy lint, typecheck và test liên quan. Kiểm tra dữ liệu cũ, retry và cạnh tranh khi chạm luồng ghi.
- Khi sửa policy hoặc SQL có quyền đặc biệt, kiểm thử bằng anon, hai tài khoản và vai trò nội bộ trong môi trường local. Khi sửa Tutor, chạy bộ đánh giá, gồm ca thiếu căn cứ và nguồn thu hồi.
- Khi bàn giao, ghi rõ file thay đổi, cách xác minh, kết quả test, phần chưa kiểm chứng và quyết định cần duyệt. Cập nhật hợp đồng và tài liệu trong cùng thay đổi nếu hành vi đã được duyệt.
