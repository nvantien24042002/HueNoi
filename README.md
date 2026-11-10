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
