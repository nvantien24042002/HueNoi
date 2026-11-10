import { createServerClient, type CookieMethodsServer, type SetAllCookies } from "@supabase/ssr";
import { isAuthRetryableFetchError, type AuthError } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

function createAuthClient(adapter: CookieMethodsServer) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;

  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true },
    auth: { experimental: { appendPkceFlowIdToRedirects: true } },
    cookies: adapter,
  });
}

// Only call from a Server Action. Server Components have read-only cookies.
export async function createActionAuthClient() {
  const store = await cookies();
  return createAuthClient({
    getAll: () => store.getAll(),
    setAll: (updates) => {
      for (const { name, value, options } of updates) {
        store.set(name, value, options);
      }
    },
  });
}

// Route Handlers return the response finalized with this request's cookie updates.
export function createRouteAuth(request: NextRequest) {
  const pendingCookies: Parameters<SetAllCookies>[0] = [];
  const authHeaders = new Headers();
  const supabase = createAuthClient({
    getAll: () => request.cookies.getAll(),
    setAll(updates, headers) {
      pendingCookies.push(...updates);
      for (const [name, value] of Object.entries(headers)) {
        authHeaders.set(name, value);
      }
    },
  });

  function finalize(response: NextResponse) {
    for (const { name, value, options } of pendingCookies) {
      response.cookies.set(name, value, options);
    }
    authHeaders.forEach((value, name) => response.headers.set(name, value));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  return { supabase, finalize };
}

export function isAuthUnavailable(error: AuthError | null) {
  return !!error && (
    isAuthRetryableFetchError(error) ||
    error.status === 429 ||
    (error.status ?? 0) >= 500
  );
}
