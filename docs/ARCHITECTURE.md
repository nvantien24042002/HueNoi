# Kiến trúc và hợp đồng API

Một ứng dụng Next.js App Router trên Vercel chứa giao diện, Route Handlers và các mô-đun nghiệp vụ. Supabase cung cấp Auth và PostgreSQL, pgvector lưu vector. Supabase Storage dành cho tư liệu nếu quy trình biên tập cần lưu tệp gốc có quyền sử dụng. LLM và embedding đi qua adapter gọi trực tiếp API nhà cung cấp.

| Mô-đun | Trách nhiệm |
|---|---|
| Auth | Phiên Supabase từ cookie, kiểm tra danh tính phía máy chủ, kiểm tra origin cho POST dùng cookie. |
| Catalog | Đọc từ, câu và nguồn đã xuất bản theo quyền người dùng. |
| Quiz | Cung cấp đề và chỉ trả đáp án sau khi người học nộp bài. Chấm và ghi kết quả trong một giao dịch. |
| Tutor | Giới hạn yêu cầu, truy xuất, gọi LLM, kiểm tra đầu ra và trích dẫn. |
| Biên tập | Công cụ chạy thủ công ngoài request path để kiểm tra, lập chỉ mục và xuất bản bản đã duyệt. |

Route Handlers xác thực và kiểm tra dữ liệu bằng Zod rồi gọi dịch vụ nghiệp vụ. Các truy vấn đọc theo người dùng chạy bằng phiên Supabase. Hàm chấm điểm có quyền tối thiểu và tự lấy danh tính từ phiên. Secret chỉ có ở máy chủ hoặc môi trường chạy nhập liệu. PWA cache tài nguyên tĩnh và màn hình offline, bỏ qua cache cho API, phiên và trang cá nhân.

## API nội bộ phiên bản 1

Các đường dẫn dưới đây bắt đầu bằng /api/v1 và yêu cầu phiên hợp lệ. Đăng nhập và callback dùng Supabase Auth. Phản hồi JSON thành công bọc trong { data }, lỗi trong { error: { code, message } }. Danh sách dùng cursor mờ, limit mặc định 20 và tối đa 50. Trả 400 khi sai schema hoặc cursor, 401 khi hết phiên, 404 cho tài nguyên không tồn tại hoặc chưa xuất bản, 409 khi khóa nộp bài bị tái sử dụng với nội dung khác, 429 khi vượt hạn mức và 503 khi phụ thuộc tạm thời lỗi. Trả Retry-After nếu biết thời gian chờ.

| Method và route | Đầu vào và dữ liệu trả về |
|---|---|
| GET /vocabulary, GET /sentences | Query cursor, limit. Trả items gồm id, text, meaning và nextCursor. |
| GET /vocabulary/{id}, GET /sentences/{id} | Trả id, text, meaning, context, example, sourceTitle và sourceLocator. Các trường bổ sung thiếu được trả null. |
| GET /quizzes | Query cursor, limit. Trả items gồm id, title và nextCursor. |
| GET /quizzes/{id} | Trả id, title, questions gồm id, prompt và options gồm id, text. |
| POST /quizzes/{id}/attempts | { submissionId, answers: [{ questionId, optionId }] }. Yêu cầu đúng một lựa chọn hợp lệ cho mỗi câu. Trả attemptId, correctCount, questionCount và results gồm questionId, correctOptionId, isCorrect. Gửi lại cùng submissionId và nội dung trả cùng kết quả. |
| GET /progress | Query cursor, limit. Trả items gồm quizId, attemptCount, bestCorrectCount, questionCount, lastAttemptAt và nextCursor. |
| POST /tutor | Union theo mode. lookup nhận { mode, message }. conversation nhận thêm history gồm tối đa 8 lượt { role, text }. message và text dài tối đa 1.000 ký tự mỗi mục. Trả { status, reply, citations }, status là answered hoặc insufficient_evidence. Citation gồm sourceTitle, sourceLocator, chunkId. |

Nộp quiz mới và phát lại thành công đều trả HTTP 200 với cùng dữ liệu. Client tạo submissionId dạng UUID và giữ nguyên khi retry. Khóa có phạm vi tài khoản, payload bao gồm quiz ID. Xử lý yêu cầu đồng thời và lỗi 409 theo [thiết kế DB](DATABASE.md).

Tutor trả JSON một lần và giữ lịch sử trong bộ nhớ trang. Lịch sử gửi từ máy khách là ngữ cảnh không tin cậy. Trả 400 nếu riêng câu hỏi vượt giới hạn embedding, 429 khi hết quota hoặc tài khoản đã có lượt đang xử lý, 503 khi hết ngân sách thử nghiệm hoặc quá timeout. Dùng mã lỗi riêng cho từng trường hợp. Hạn mức áp dụng xuyên instance theo [thiết kế RAG](RAG_DESIGN.md). Theo dõi độ trễ, lỗi, token và chi phí dự toán, không ghi nội dung chat.
