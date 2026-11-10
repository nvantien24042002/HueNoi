import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import test from "node:test";
import { fileURLToPath } from "node:url";

test("HTTP Auth của HueNoi", { timeout: 60_000 }, async (t) => {
  const cwd = fileURLToPath(new URL("..", import.meta.url));
  const server = spawn(process.execPath, [
    "node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "0",
  ], {
    cwd,
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:1",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "test-placeholder",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const closed = once(server, "close");
  t.after(async () => {
    server.kill();
    await closed;
  });

  const origin = await new Promise((resolve, reject) => {
    let stdout = "";
    server.stdout.on("data", (chunk) => {
      stdout += chunk;
      const address = stdout.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      if (address && stdout.includes("Ready in")) resolve(address);
    });
    server.stderr.on("data", (chunk) => t.diagnostic(String(chunk).trim()));
    server.once("error", reject);
    server.once("close", (code) => reject(new Error(`Next.js exited (${code}): ${stdout}`)));
    t.signal.addEventListener("abort", () => reject(t.signal.reason), { once: true });
  });

  async function expectUnauthorized(headers) {
    const response = await fetch(`${origin}/api/v1/session`, { headers, signal: t.signal });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(await response.json(), {
      error: { code: "UNAUTHORIZED", message: "Cần đăng nhập." },
    });
  }

  await t.test("thiếu cookie trả 401", () => expectUnauthorized());
  await t.test("cookie hỏng cố ý trả 401 và có thể sinh cảnh báo giải mã", () =>
    expectUnauthorized({ Cookie: "sb-127-auth-token=base64-bm90LWpzb24" }));
  await t.test("callback thiếu mã quay về trang tài khoản", async () => {
    const response = await fetch(`${origin}/auth/callback`, {
      redirect: "manual",
      signal: t.signal,
    });
    assert.equal(response.status, 307);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(response.headers.get("location"), "/account?notice=invalid-link");
  });
});
