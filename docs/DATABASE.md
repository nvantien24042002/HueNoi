# Thiết kế cơ sở dữ liệu

PostgreSQL dùng UUID cho định danh, timestamptz cho thời điểm và khóa ngoại cho mọi quan hệ. Thiết kế dưới đây là đặc tả cho milestone triển khai. Người dùng nằm trong auth.users, không cần bảng hồ sơ cho MVP.

| Bảng | Cột chính và ràng buộc |
|---|---|
| content_sources | id, title, locator, rights_note, status, reviewed_by, reviewed_at. Trạng thái draft, published, withdrawn. Xuất bản yêu cầu thông tin quyền sử dụng và duyệt. |
| learning_entries | id, source_id → content_sources, kind (vocabulary hoặc sentence), text, meaning, context, example, source_locator, status. |
| quizzes | id, title, status. Bản đã xuất bản bất biến về đề và đáp án. Khi sửa, phát hành quiz ID mới. |
| quiz_questions | id, quiz_id → quizzes, prompt, position. Duy nhất (quiz_id, position). |
| quiz_options | id, question_id → quiz_questions, text, position. Duy nhất (question_id, position) và (question_id, id). |
| quiz_answer_keys | question_id là PK, correct_option_id. FK ghép (question_id, correct_option_id) → quiz_options bảo đảm đáp án thuộc câu. Kiểm tra mỗi câu có đúng một đáp án và ít nhất hai lựa chọn trước khi xuất bản. |
| quiz_attempts | id, user_id → auth.users, quiz_id → quizzes, submission_id, request_payload chuẩn hóa, correct_count, question_count, submitted_at. Duy nhất (user_id, submission_id). Điểm nằm trong [0, question_count] và question_count > 0. |
| quiz_attempt_answers | attempt_id → quiz_attempts, question_id → quiz_questions, option_id, is_correct. PK (attempt_id, question_id), FK ghép (question_id, option_id) → quiz_options. Hàm chấm kiểm tra mọi question_id thuộc quiz. |
| rag_chunks | id, source_id → content_sources, revision, ordinal, source_locator, body, content_hash, embedding, embedding_model, status. Duy nhất (source_id, revision, ordinal). Một revision được công bố mỗi nguồn. |
| tutor_usage_windows | user_id → auth.users, window_start, request_count. PK (user_id, window_start), dọn cửa sổ hết hạn theo lịch bảo trì. |
| tutor_active_leases | user_id → auth.users là PK, lease_id, expires_at. Một slot mỗi tài khoản. |
| tutor_pilot_budgets | period_id là PK, reserved_usd, settled_usd. Khóa hàng khi kiểm tra và đặt chỗ. |
| tutor_cost_reservations | request_id là PK, period_id → tutor_pilot_budgets, reserved_usd, actual_usd, status. Đối soát một lần theo request_id. |

Tiến độ tổng hợp từ quiz_attempts theo user_id và quiz_id. Lập chỉ mục (user_id, quiz_id, submitted_at), các khóa ngoại truy vấn thường xuyên, và (kind, status, id) cho danh mục. Vector cố định số chiều theo model chọn tại M1. MVP dùng tìm kiếm cosine chính xác. Đo tải trước khi cân nhắc chỉ mục xấp xỉ.

## Invariant công bố và quyền truy cập

Một entry chỉ hiển thị nếu chính entry và nguồn liên kết đều có status = published. Áp dụng điều kiện đồng thời tại policy SELECT, cho cả danh sách lẫn chi tiết. Truy xuất RAG áp cùng điều kiện đối với chunk và nguồn, kể cả nhánh khớp văn bản. Sau khi giao dịch chuyển nguồn sang withdrawn commit, mọi lần đọc mới phải loại entry và chunk liên quan, dù trạng thái từng hàng con vẫn là published. API và trang đọc động, không cache kết quả công bố. Tutor kiểm tra lại tất cả nguồn của ngữ cảnh trước khi trả lời, kể cả nguồn không xuất hiện trong citation. Dữ liệu đã trả trước khi thu hồi nằm ngoài bảo đảm này.

Bật RLS trên bảng ứng dụng. Cấp quyền theo bảng, cột và hàm cụ thể. Bảng dưới liệt kê toàn bộ quyền nghiệp vụ được cấp, các quyền còn lại bị từ chối.

| Vai trò | SELECT | INSERT | UPDATE | DELETE | EXECUTE |
|---|---|---|---|---|---|
| anon | Chỉ cột công khai của hai bảng danh mục theo invariant công bố | Không | Không | Không | Không có RPC nghiệp vụ |
| authenticated | Cột công khai của danh mục và nguồn published, đề và lựa chọn thuộc quiz published, lượt làm và câu trả lời của chính mình kể cả sau thu hồi quiz | Không | Không | Không | RPC nộp quiz |
| Nội bộ biên tập | Nguồn, entry, chunk và dữ liệu soạn quiz | Cùng nhóm bảng | Cùng nhóm bảng, giữ đề và đáp án đã công bố bất biến | Không, dùng trạng thái thu hồi | Không có RPC nghiệp vụ |
| Nội bộ Tutor | Đọc chunk và cột nguồn cần thiết qua policy published | Chỉ trạng thái hạn mức và đặt chỗ chi phí | Chỉ trạng thái hạn mức và đặt chỗ chi phí | Chỉ bản ghi vận hành hết hạn theo lịch bảo trì | Không có RPC quiz |
| Chủ RPC chấm điểm | Quiz, câu hỏi, lựa chọn, đáp án và kết quả cần cho chấm hoặc phát lại | quiz_attempts và quiz_attempt_answers | Không | Không | Chỉ các hàm phụ trợ cần thiết |

Vai trò nội bộ dùng thông tin xác thực riêng phía máy chủ, không dùng service_role trong request path. Tách vai trò chủ RPC thành NOLOGIN, không là chủ bảng, không có BYPASSRLS, không cấp membership cho client. Policy riêng cho chủ RPC chỉ cho phép quyền trong bảng trên, giới hạn kết quả đọc và ghi theo auth.uid() và quyền đọc đáp án theo nhu cầu chấm hoặc phát lại. Xóa tài khoản dùng cascade do FK, gồm lượt làm, đáp án đã chọn và bộ đếm cá nhân.

### Danh mục M1-04 trên local

Data API cho anon và authenticated đọc cột công khai của nguồn (id, title, locator, status) và các cột entry qua RLS. Quyền này không thay đổi yêu cầu đăng nhập ở các API Next.js. Nguồn duy nhất theo (title, locator), với giới hạn byte cho khóa ghép. reviewed_by tham chiếu auth.users và giữ dấu vết duyệt bằng FK restrict. Nguồn published cần quyền sử dụng, người duyệt và thời điểm duyệt.

Role hue_catalog_editor là role nhóm NOLOGIN, không có BYPASSRLS. Cấp membership rõ ràng cho login PostgreSQL riêng của công cụ nội bộ. Không cấp cho anon, authenticated hay authenticator. Metadata do người dùng gửi không tham gia cấp quyền. Role này có SELECT, INSERT, UPDATE trên hai bảng và dùng trạng thái withdrawn thay cho DELETE. Migration không tạo login hoặc thông tin xác thực, view hay RPC.

## RPC chấm quiz và xử lý đồng thời

RPC là SECURITY DEFINER, thuộc vai trò chủ RPC chuyên biệt. Đặt search_path cố định là pg_catalog, pg_temp theo thứ tự này, định danh đầy đủ schema của bảng và hàm ngoài pg_catalog, không dùng SQL động. Trong cùng migration tạo hàm, thu hồi EXECUTE mặc định từ PUBLIC, anon và các vai trò nội bộ, rồi cấp riêng chữ ký RPC cho authenticated. Lấy user_id từ auth.uid(), từ chối phiên thiếu danh tính, kiểm tra cấu trúc đầu vào, ID và câu hỏi trùng ngay trong RPC vì client có thể gọi trực tiếp.

1. Chuẩn hóa payload thành quiz ID và các cặp questionId–optionId sắp theo questionId. Thứ tự phần tử không làm đổi nội dung. Lưu payload chuẩn hóa cùng lượt làm để so sánh chính xác.
2. Trong giao dịch READ COMMITTED, lấy khóa advisory cấp giao dịch theo khóa xác định từ (user_id, submission_id). Hai yêu cầu cùng cặp phải tuần tự hóa. Va chạm khóa băm giữa các cặp chỉ làm chờ thêm. Sau khi lấy khóa, dùng câu truy vấn riêng để đọc lượt đã commit.
3. Nếu đã có lượt, payload trùng trả kết quả đã lưu theo thứ tự câu hỏi ổn định, kể cả khi quiz đã thu hồi. Payload khác trả lỗi nghiệp vụ ánh xạ HTTP 409. Nếu chưa có lượt, kiểm tra quiz published, đủ câu và lựa chọn hợp lệ rồi chấm, ghi lượt cùng đáp án trong một giao dịch.
4. UNIQUE (user_id, submission_id) là lớp bảo vệ ở DB. Yêu cầu đến sau đợi commit rồi đọc lại. Nếu giao dịch trước rollback, yêu cầu đến sau có thể tạo lượt. Lỗi giữa chừng rollback toàn bộ. Kết quả phát lại dùng điểm đã lưu và khóa đáp án bất biến.

Kiểm thử trên hai kết nối cùng tài khoản với payload trùng, đảo thứ tự và khác nội dung, xác nhận đúng một lượt và đúng số dòng đáp án. Kiểm thử thêm rollback rồi retry, phát lại sau thu hồi, và hai tài khoản dùng cùng submissionId độc lập.
