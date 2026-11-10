"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createActionAuthClient } from "../../lib/auth/server";

async function requestOrigin() {
  // Next.js compares Origin against Host or X-Forwarded-Host for Server Actions.
  const origin = (await headers()).get("origin");
  if (!origin || !URL.canParse(origin) || new URL(origin).origin !== origin) {
    redirect("/account?notice=invalid-request");
  }
  return origin;
}

export async function signIn(formData: FormData) {
  const origin = await requestOrigin();
  const email = z.string().trim().max(254).email().safeParse(formData.get("email"));
  if (!email.success) redirect("/account?notice=invalid-email");

  const supabase = await createActionAuthClient();
  if (!supabase) redirect("/account?notice=unavailable");

  const { error } = await supabase.auth.signInWithOtp({
    email: email.data,
    options: { emailRedirectTo: new URL("/auth/callback", origin).href },
  });
  redirect(error ? "/account?notice=send-failed" : "/account?notice=sent");
}

export async function signOut() {
  await requestOrigin();
  const supabase = await createActionAuthClient();
  if (!supabase) redirect("/account?notice=unavailable");

  const { error } = await supabase.auth.signOut({ scope: "local" });
  redirect(error ? "/account?notice=sign-out-failed" : "/account?notice=signed-out");
}
