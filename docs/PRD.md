# PRD HueNoi — bản đề xuất

HueNoi giúp người học tra cứu và luyện tiếng Huế trên web và PWA. MVP ưu tiên nội dung có nguồn, bài học ngắn và phản hồi AI có thể kiểm chứng. Giả định ban đầu là một nhóm thử nghiệm dùng giao diện tiếng Việt, có kết nối mạng và chấp nhận đăng nhập bằng email.

| Phạm vi | Tiêu chí nghiệm thu |
|---|---|
| Đăng nhập | Người dùng đăng nhập bằng liên kết email, đăng xuất và mở lại phiên hợp lệ. Truy cập API học tập khi chưa đăng nhập trả 401. |
| Học từ vựng | Xem danh sách và chi tiết mục đã xuất bản, gồm từ, nghĩa, ví dụ nếu có và nguồn. |
| Học câu | Xem câu, nghĩa, ngữ cảnh sử dụng và nguồn của câu đã xuất bản. |
| Quiz và tiến độ | Trả lời trắc nghiệm một đáp án, nhận điểm sau khi nộp và xem số lượt làm cùng điểm tốt nhất theo quiz. |
| Tutor tra cứu | Hỏi nghĩa hoặc cách dùng, nhận giải thích kèm nguồn khi đủ căn cứ, hoặc trạng thái thiếu căn cứ. |
| Tutor hội thoại | Luyện đối đáp qua văn bản trong phiên hiện tại, nhận phản hồi dựa trên nguồn duyệt. Có thể bắt đầu lại bằng cách xóa lịch sử trên giao diện. |
| Web và PWA | Giao diện dùng được trên điện thoại và desktop. Kiểm thử cài đặt trên trình duyệt mục tiêu và màn hình báo mất mạng. |

Ngoài MVP gồm audio, nhận dạng giọng nói, chấm phát âm, học ngoại tuyến, lưu lịch sử Tutor qua thiết bị, mạng xã hội, thanh toán và giao diện quản trị nội dung. Nhóm biên tập bàn giao nội dung có quyền sử dụng qua quy trình nhập nội bộ. PWA khi mất mạng chỉ hiển thị màn hình báo mất kết nối.

Quy mô đề xuất là 100 mục từ, 50 câu mẫu, 5 quiz có 5 câu mỗi quiz và tối đa 30 người được mời thử nghiệm. Nghiệm thu bằng số lượng mục đã duyệt, có locator và truy cập được, cùng 5 quiz chạy xuyên suốt. Kiểm thử thu hồi nguồn trên danh sách, chi tiết và Tutor. Kiểm thử nộp đồng thời cùng khóa chỉ tạo một lượt, trả lại kết quả hoặc 409 theo nội dung.

Điều kiện mở thử nghiệm gồm corpus được người phụ trách duyệt, luồng học và nộp bài chạy xuyên suốt, kiểm thử cách ly dữ liệu hai tài khoản đạt, và bộ đánh giá Tutor qua ngưỡng Product Owner chốt ở M1. Số lượng nội dung, nhóm người học và trình duyệt mục tiêu cần chốt ở M1.
