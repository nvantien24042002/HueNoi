# HueNoi

## Chạy local

Cần Node.js 24 và npm. Chạy `npm ci`, sau đó `npm run dev`. Mở http://localhost:3000.

Chạy `npm run lint`, `npm run typecheck`, `npm test` và `npm run build` để kiểm tra. Trang nền tảng chạy được khi chưa cấu hình Supabase. Xem [.env.example](.env.example) cho tên biến cấu hình local.

Phạm vi triển khai hiện tại theo [M1](docs/TASKS.md).

## Kiểm thử đăng nhập email với Supabase local

1. Kiểm tra Supabase local đang chạy bằng `npx supabase status`. Sao chép
   `.env.example` thành `.env.local` và điền API URL local cùng publishable key
   từ kết quả status. Không dùng service-role key. Giữ `.env.local` ở máy local.
2. Chạy `npm run dev -- --hostname 127.0.0.1` và mở
   http://127.0.0.1:3000/account. Dùng đúng origin này để khớp cấu hình Auth local.
3. Nhập email thử nghiệm và mở hộp thư Mailpit tại http://127.0.0.1:54324.
   Mở liên kết trong cùng trình duyệt đã gửi yêu cầu để giữ cookie PKCE.
4. Xác nhận trang hiển thị email đã đăng nhập. Reload và xác nhận phiên vẫn
   tồn tại. Mở `/api/v1/session` và kiểm tra HTTP 200 cùng ID và email.
5. Đăng xuất, reload và kiểm tra trang hiển thị lại form email. Trong DevTools
   hoặc với `curl -i http://127.0.0.1:3000/api/v1/session`, kiểm tra HTTP 401.
   Cửa sổ ẩn danh chưa đăng nhập cũng nhận 401.

`npm test` chạy bài kiểm thử trang chủ và kiểm thử HTTP Auth trên một cổng
ngẫu nhiên. Các ca thiếu phiên, cookie hỏng và callback thiếu mã không cần
Supabase đang chạy. Dừng dev server của repo trước khi chạy bộ test để tránh
tranh chấp khóa Next.js.

### Kiểm tra callback và refresh trên Supabase local

Khi app và Supabase local đang chạy theo các cổng trên, nạp hai biến cấu hình
local vào môi trường shell rồi chạy `node test/auth-local.mjs`. Bài kiểm thử
tạo một tài khoản email thử nghiệm trong Supabase local, đọc liên kết từ
Mailpit và kiểm tra `Set-Cookie` trên redirect PKCE lẫn phản hồi refresh.
Bài test chỉnh thời điểm hết hạn trong cookie thử để buộc SDK gọi refresh
thật, rồi dùng cookie response ở request kế tiếp. Bộ `npm test` độc lập với
Supabase. Cảnh báo giải mã cookie ở ca HTTP cố tình gửi dữ liệu hỏng là dự kiến.

## Kiểm thử schema và RLS danh mục local

1. Trong checkout này, kiểm tra Supabase local đang chạy rồi dùng
   `npx supabase migration up --local` và `npx supabase migration list --local`.
2. Nạp `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321` và publishable key
   local vào shell. Chạy `node --test test/catalog-local.mjs` trong WSL.
3. Bài test cần Docker local với container DB `supabase_db_HueNoi-git` và
   cấu hình Auth local cho phép đăng ký fixture không cần xác nhận email.
   Fixture giả lập có nhãn riêng, dùng hai JWT thật từ Supabase Auth và một
   login PostgreSQL tạm có membership biên tập. Bài test dọn dữ liệu và login
   tạm khi kết thúc. Kết nối quản trị chỉ phục vụ cấp/dọn fixture và kiểm kê
   schema. Không dùng service-role key.

Sau mỗi yêu cầu ghi từ anon hoặc một trong hai JWT, test dùng kết nối editor
riêng để so sánh toàn bộ fixture trước và sau. Cả hai biến thể UPDATE có và
không có `.select()` phải trả lỗi quyền `42501`. Test cũng kiểm tra quyền
hiệu lực của các role API, gồm kế thừa và khả năng chuyển sang role editor.
GraphQL đang tắt trên stack local. Bài test chỉ xác nhận endpoint không trả dữ
liệu khi tắt, chưa đánh giá RLS qua GraphQL khi bật.
