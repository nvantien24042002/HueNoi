import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createRouteAuth, isAuthUnavailable } from "../../../lib/auth/server";

export async function GET(request: NextRequest) {
  const { supabase, finalize } = createRouteAuth(request);
  function redirectToAccount(notice?: string) {
    const location = notice ? `/account?notice=${notice}` : "/account";
    return finalize(new NextResponse(null, { status: 307, headers: { Location: location } }));
  }

  const code = z.string().min(1).max(2048).safeParse(request.nextUrl.searchParams.get("code"));
  if (!code.success) return redirectToAccount("invalid-link");
  if (!supabase) return redirectToAccount("unavailable");

  const flowId = request.nextUrl.searchParams.get("sb_flow_id");
  const { data, error } = await supabase.auth.exchangeCodeForSession(
    code.data,
    flowId === null ? undefined : { flowId },
  );
  if (isAuthUnavailable(error)) return redirectToAccount("unavailable");
  if (error || !data.session) return redirectToAccount("invalid-link");
  return redirectToAccount();
}
