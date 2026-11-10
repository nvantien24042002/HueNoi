"use client";

import { useEffect, useState, type ReactNode } from "react";

type Session = "loading" | "signed-out" | "unavailable" | { email: string | null };

export function AccountSession({
  signInForm,
  signOutForm,
}: {
  signInForm: ReactNode;
  signOutForm: ReactNode;
}) {
  const [session, setSession] = useState<Session>("loading");

  useEffect(() => {
    const controller = new AbortController();
    async function loadSession() {
      try {
        const response = await fetch("/api/v1/session", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const { data } = await response.json();
          setSession({ email: data.email });
        } else {
          setSession(response.status === 401 ? "signed-out" : "unavailable");
        }
      } catch {
        if (!controller.signal.aborted) setSession("unavailable");
      }
    }
    void loadSession();
    return () => controller.abort();
  }, []);

  if (session === "loading") return <p role="status">Đang kiểm tra phiên…</p>;
  if (session === "unavailable") return <p role="alert">Không thể kiểm tra phiên.</p>;
  if (session === "signed-out") return signInForm;
  return (
    <>
      <p>Đã đăng nhập{session.email && ` với ${session.email}`}.</p>
      {signOutForm}
    </>
  );
}
