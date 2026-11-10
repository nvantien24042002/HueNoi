# Thiết kế RAG

Corpus gồm tài liệu tiếng Huế có quyền sử dụng và đã được người phụ trách ngôn ngữ kiểm duyệt. Mỗi tài liệu có mã nguồn, bản sửa đổi, locator theo trang hoặc mục, quyền sử dụng và dấu vết phê duyệt. Hai chế độ Tutor dùng chung một pipeline.

## Nhập và xuất bản

1. Nhận bản bàn giao có metadata và bằng chứng duyệt. Từ chối nguồn thiếu quyền sử dụng hoặc bản duyệt. Không lấy nội dung chat hay trang web động làm nguồn.
2. Chuẩn hóa Unicode NFC, giữ dấu và nguyên văn. Chia theo mục từ, câu hoặc đoạn có nghĩa. Giữ phần nghĩa và ngữ cảnh cùng đoạn nếu vừa giới hạn embedding. Gắn locator và hash nội dung.
3. Tạo embedding bằng model cố định, ghi staging theo source, revision và ordinal. Retry tái sử dụng đoạn cùng hash và model. Kiểm tra đủ chunk, đúng số chiều và hợp lệ locator trước khi công bố.
4. Chuyển revision mới sang published và rút revision cũ trong một giao dịch. Lỗi giữa chừng giữ bản công bố hiện hành. Thu hồi nguồn khiến toàn bộ chunk nguồn đó bị loại khỏi truy xuất. Khi đổi model, tạo lại chỉ mục và chuyển đồng bộ embedding truy vấn lẫn corpus.

## Truy xuất và sinh câu trả lời

1. Kiểm tra phiên, hạn mức, độ dài. Tra cứu dùng câu hỏi hiện tại. Hội thoại dùng câu hiện tại và ngữ cảnh gần nhất để tìm căn cứ, coi toàn bộ lịch sử là dữ liệu đầu vào.
2. Tìm mục khớp chính xác sau chuẩn hóa NFC và chữ hoa/thường, kết hợp xếp hạng cosine. Chỉ lấy chunk và nguồn đang published, cùng model với truy vấn. Chốt top-k và ngưỡng từ bộ đánh giá. Khi không đạt ngưỡng, trả insufficient_evidence.
3. Gửi các đoạn có mã tham chiếu vào prompt dưới dạng dữ liệu. Chỉ dẫn trong tài liệu hoặc lời người dùng không được đổi quy tắc của hệ thống. LLM tạo JSON theo schema. Lookup giải thích nghĩa và cách dùng. Conversation tiếp lời và góp ý dựa trên các mẫu hoặc cấu trúc đã được chứng thực. Khi thiếu căn cứ, trả lời bằng tiếng Việt phổ thông và mời người dùng làm rõ.
4. Kiểm tra schema, bắt buộc answered có trích dẫn và từ chối mọi chunk ID ngoài tập đã truy xuất. Kiểm tra lại mọi chunk đưa vào prompt và nguồn của chúng trước khi trả. Nếu có chunk hoặc nguồn đã thu hồi, hoặc đầu ra sai, trả insufficient_evidence với citations rỗng. Timeout hoặc lỗi nhà cung cấp trả 503.

## Giới hạn thử nghiệm đề xuất

| Biến môi trường phía máy chủ | Mặc định đề xuất |
|---|---|
| TUTOR_REQUESTS_PER_DAY | 20 lượt mỗi tài khoản mỗi ngày UTC |
| Concurrency theo tài khoản | 1 lượt đồng thời, tương ứng một lease mỗi tài khoản trong MVP |
| TUTOR_MAX_INPUT_TOKENS / TUTOR_MAX_OUTPUT_TOKENS | 3.000 token vào gồm prompt, lịch sử và nguồn / 350 token ra |
| TUTOR_MAX_EMBEDDING_TOKENS | 512 token truy vấn |
| TUTOR_TIMEOUT_MS | 12.000 ms toàn pipeline, tối đa 2.000 ms embedding và 8.000 ms LLM trong thời gian còn lại |
| TUTOR_PILOT_BUDGET_USD | 30 USD cho LLM và embedding truy vấn trong 30 ngày |
| RAG_INGEST_BUDGET_USD | 5 USD riêng cho embedding nhập liệu đợt thử nghiệm |

Kiểm tra cấu hình và đơn giá model khi khởi động. Đếm token trước khi gọi, giảm lịch sử cũ và số chunk trong giới hạn, trả thiếu căn cứ nếu không giữ được nguồn phù hợp. Hủy lời gọi khi quá deadline và không tự retry trong request.

Trong một giao dịch PostgreSQL, kiểm tra quota, lấy slot bằng lease dài hơn deadline và đặt chỗ chi phí tối đa theo đơn giá. Lượt đã nhận tính quota kể cả khi upstream lỗi. Giải phóng slot theo đúng lease ID, slot tự hết hạn nếu tiến trình chết. Ngân sách dùng chung giữa các instance trong kỳ có thời điểm bắt đầu và kết thúc cấu hình qua môi trường. Đối soát chi phí một lần theo request ID, giữ khoản tối đa khi chưa biết usage. Dừng nhận lượt khi không đủ ngân sách. Công cụ nhập liệu kiểm tra trần riêng trước mỗi lô, kể cả lô chạy lại. Đối chiếu dự toán với hóa đơn nhà cung cấp.

## Đánh giá

Đề xuất tối thiểu 60 ca giữ riêng khỏi tập tinh chỉnh, gồm ít nhất 30 ca có căn cứ và 20 ca cần từ chối. Bao phủ cả hai mode, biến thể đã xác minh, câu hỏi mơ hồ, ngoài corpus, nguồn thu hồi và prompt injection. Mỗi ca ghi mode, trạng thái kỳ vọng, locator nếu có và tiêu chí chấm.

| Chỉ số | Ngưỡng đề xuất trước mở thử nghiệm |
|---|---|
| Tìm đúng nguồn trong top 5 | ≥ 90% ca có căn cứ có ít nhất một locator kỳ vọng |
| Độ đúng nghĩa và ngữ cảnh | ≥ 90% ca có căn cứ được người duyệt chấm đúng, tính từ chối sai là không đạt |
| Citation hợp lệ | 100% phản hồi answered có citation thuộc tập truy xuất và còn công bố |
| Câu trả lời được nguồn hỗ trợ | ≥ 95% phản hồi answered có mọi nhận định về tiếng Huế được đoạn trích hỗ trợ theo người duyệt |
| Từ chối đúng | ≥ 95% ca cần từ chối trả insufficient_evidence. Không dùng nguồn thu hồi trong mọi ca thu hồi |
| Độ trễ | p95 ≤ 8 giây trên tối thiểu 60 lượt ở tải thử 5 tài khoản đồng thời, tính cả lỗi và timeout |

Citation hợp lệ được kiểm tra tự động theo ID và trạng thái. Người duyệt đối chiếu từng nhận định về nghĩa, ngữ cảnh hoặc cách dùng với đoạn trích để chấm mức hỗ trợ. Báo cáo tử số, mẫu số và lỗi theo mode. M1 chốt rubric và ngưỡng, M3 chạy đánh giá, M4 dùng kết quả để quyết định mở thử nghiệm.
