"use client";

import { useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Magic-link login. Domain whitelist + admin approval gate is enforced
 * server-side (signup row creation + linemates.status='pending') — this
 * page is just the entry point.
 */
export default function LoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "sending" });

    const supabase = createClient();
    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: true, // 첫 로그인 시 auth.users + linemates row 자동 생성
      },
    });

    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }

    setState({ kind: "sent" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">라인메이트 로그인</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            이메일로 로그인 링크를 받습니다.
          </p>
        </header>

        {state.kind === "sent" ? (
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 text-sm">
            <p className="font-medium">링크를 보냈습니다.</p>
            <p className="mt-1 text-neutral-600 dark:text-neutral-400">
              {email}으로 도착한 메일에서 로그인 버튼을 눌러주세요.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">이메일</span>
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@lineedu.kr"
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
              />
            </label>

            {state.kind === "error" && (
              <p className="text-sm text-red-600 dark:text-red-400">
                {state.message}
              </p>
            )}

            <button
              type="submit"
              disabled={state.kind === "sending"}
              className="w-full rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2.5 text-base font-medium disabled:opacity-50"
            >
              {state.kind === "sending" ? "보내는 중..." : "로그인 링크 보내기"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
