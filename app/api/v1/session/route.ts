import { NextResponse, type NextRequest } from "next/server";
import { createRouteAuth, isAuthUnavailable } from "../../../../lib/auth/server";

export async function GET(request: NextRequest) {
  const { supabase, finalize } = createRouteAuth(request);
  function json(body: unknown, status: number) {
    return finalize(NextResponse.json(body, { status }));
  }

  if (!supabase) {
    return json({ error: { code: "AUTH_UNAVAILABLE", message: "Chưa cấu hình Auth." } }, 503);
  }

  const { data: { user }, error } = await supabase.auth.getUser();
  if (isAuthUnavailable(error)) {
    return json({ error: { code: "AUTH_UNAVAILABLE", message: "Auth tạm thời gián đoạn." } }, 503);
  }
  if (!user || error) {
    return json({ error: { code: "UNAUTHORIZED", message: "Cần đăng nhập." } }, 401);
  }
  return json({ data: { id: user.id, email: user.email ?? null } }, 200);
}
