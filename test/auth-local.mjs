import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { createServerClient } from "@supabase/ssr";

const app = "http://127.0.0.1:3000";
const api = "http://127.0.0.1:54321";
const inbox = "http://127.0.0.1:54324/api/v1";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert.ok(key, "Provide the Supabase local publishable key");
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, api, "Use the Supabase local API");

const cookies = new Map();
const sdk = createServerClient(api, key, {
  cookieOptions: { httpOnly: true },
  auth: { experimental: { appendPkceFlowIdToRedirects: true } },
  cookies: {
    getAll: () => [...cookies].map(([name, value]) => ({ name, value })),
    setAll(updates) {
      for (const { name, value, options } of updates) {
        if (options.maxAge === 0) cookies.delete(name);
        else cookies.set(name, value);
      }
    },
  },
});

function request(url) {
  return fetch(url, {
    redirect: "manual",
    headers: { Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join("; ") },
    signal: AbortSignal.timeout(10_000),
  });
}

function saveResponseCookies(response) {
  const fields = response.headers.getSetCookie();
  for (const field of fields) {
    const [pair] = field.split(";");
    const equals = pair.indexOf("=");
    const name = pair.slice(0, equals);
    assert.match(field, /;\s*HttpOnly(?:;|$)/i);
    if (/;\s*Max-Age=0(?:;|$)/i.test(field)) cookies.delete(name);
    else cookies.set(name, pair.slice(equals + 1));
  }
  return fields;
}

const email = `m103-${randomUUID()}@example.com`;
const { error } = await sdk.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: app + "/auth/callback" },
});
assert.ifError(error);
const verifier = [...cookies.keys()].find((name) => name.endsWith("-code-verifier"));
assert.ok(verifier, "SDK stored a PKCE verifier");

let message;
for (let attempt = 0; attempt < 30 && !message; attempt++) {
  const listing = await fetch(inbox + "/messages", { signal: AbortSignal.timeout(5_000) });
  assert.ok(listing.ok);
  message = (await listing.json()).messages.find((entry) => entry.To.some((to) => to.Address === email));
  if (!message) await delay(500);
}
assert.ok(message, "Mailpit received the local sign-in email");
const mailResponse = await fetch(inbox + "/message/" + message.ID, { signal: AbortSignal.timeout(5_000) });
assert.ok(mailResponse.ok);
const link = (await mailResponse.json()).Text.match(/https?:\/\/[^\s<>]+\/auth\/v1\/verify\?[^\s<>]+/)?.[0];
assert.ok(link);
assert.equal(new URL(link).origin, api);
const verification = await fetch(link, { redirect: "manual", signal: AbortSignal.timeout(10_000) });
const callbackUrl = new URL(verification.headers.get("location"));
assert.equal(callbackUrl.origin, app);
assert.equal(callbackUrl.pathname, "/auth/callback");
assert.ok(callbackUrl.searchParams.get("code"));
assert.ok(callbackUrl.searchParams.get("sb_flow_id"));

const callback = await request(callbackUrl);
assert.equal(callback.status, 307);
assert.equal(callback.headers.get("location"), "/account");
assert.equal(callback.headers.get("cache-control"), "private, no-store");
const callbackFields = saveResponseCookies(callback);
assert.ok(callbackFields.length >= 2, "Callback writes session cookies and clears the verifier");
assert.ok(!cookies.has(verifier));
assert.ok(callbackFields.some((field) => field.startsWith(verifier + "=") && /Max-Age=0/i.test(field)));

const sessionUrl = app + "/api/v1/session";
const initial = await request(sessionUrl);
assert.equal(initial.status, 200);
const { data: identity } = await initial.json();
assert.equal(identity.email, email);
assert.ok(identity.id);

// Keep real credentials and make the SDK consider the stored access token expired.
// This exercises a real refresh-token exchange without changing Supabase's JWT TTL.
const tokenCookies = [...cookies].filter(([name]) => /^sb-.*-auth-token(?:\.\d+)?$/.test(name));
assert.ok(tokenCookies.length > 0);
tokenCookies.sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true }));
const stored = tokenCookies.map(([, value]) => decodeURIComponent(value)).join("");
assert.ok(stored.startsWith("base64-"));
const session = JSON.parse(Buffer.from(stored.slice(7), "base64url").toString("utf8"));
session.expires_at = Math.floor(Date.now() / 1_000) - 1;
for (const [name] of tokenCookies) cookies.delete(name);
const tokenName = tokenCookies[0][0].replace(/\.0$/, "");
cookies.set(tokenName, "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url"));

const refreshed = await request(sessionUrl);
assert.equal(refreshed.status, 200);
assert.equal(refreshed.headers.get("cache-control"), "private, no-store");
assert.deepEqual((await refreshed.json()).data, identity);
const refreshFields = saveResponseCookies(refreshed);
assert.ok(refreshFields.some((field) => field.startsWith(tokenName) && !/Max-Age=0/i.test(field)));
const nextRead = await request(sessionUrl);
assert.equal(nextRead.status, 200);
assert.deepEqual((await nextRead.json()).data, identity);
assert.equal(nextRead.headers.getSetCookie().length, 0, "The persisted session does not need another refresh");
console.log("PASS: callback PKCE, HttpOnly cookies, verifier cleared, real refresh and persisted session");
