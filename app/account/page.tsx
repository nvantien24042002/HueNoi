import { signIn, signOut } from "./actions";
import { AccountSession } from "./session";

const notices = new Map([
  ["sent", "Đã gửi liên kết. Hãy mở liên kết bằng trình duyệt này."],
  ["invalid-email", "Địa chỉ email không hợp lệ."],
  ["invalid-link", "Liên kết không hợp lệ hoặc đã hết hạn. Hãy yêu cầu liên kết mới."],
  ["invalid-request", "Yêu cầu không hợp lệ."],
  ["send-failed", "Không thể gửi liên kết. Vui lòng thử lại."],
  ["sign-out-failed", "Không thể đăng xuất. Vui lòng thử lại."],
  ["signed-out", "Đã đăng xuất."],
  ["unavailable", "Auth chưa được cấu hình hoặc đang tạm gián đoạn."],
]);

export default async function Account({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string | string[] }>;
}) {
  const { notice } = await searchParams;
  const message = typeof notice === "string" ? notices.get(notice) : undefined;
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <h1 className="text-3xl font-bold">Tài khoản HueNoi</h1>
      {message && <p role="status">{message}</p>}
      <AccountSession
        key={notice?.toString()}
        signInForm={
          <form action={signIn} className="space-y-3">
            <label className="block" htmlFor="email">Email</label>
            <input className="block w-full rounded border px-3 py-2" id="email" name="email"
              type="email" autoComplete="email" required maxLength={254} />
            <button className="rounded bg-black px-4 py-2 text-white">Gửi liên kết đăng nhập</button>
          </form>
        }
        signOutForm={
          <form action={signOut}>
            <button className="rounded border px-4 py-2">Đăng xuất</button>
          </form>
        }
      />
    </main>
  );
}
