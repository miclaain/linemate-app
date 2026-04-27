"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Map known Supabase / app error codes to friendly Korean messages.
 * Kept narrow on purpose — unknown codes fall through to raw description.
 */
function describeError(code: string | null, raw: string | null): string {
  if (code === "otp_expired" || raw === "missing_code") {
    return "로그인 링크가 만료되었거나 이미 사용되었습니다. 새 링크를 받아주세요.";
  }
  if (code === "access_denied") {
    return "로그인이 거절되었습니다. 새 링크를 받아 다시 시도해주세요.";
  }
  if (raw) return raw;
  if (code) return code;
  return "로그인에 실패했습니다.";
}

export function LoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";

  const [mode, setMode] = useState<"magic" | "password">("magic");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  // Surface errors from BOTH ?error= (our callback) and #error= (Supabase
  // appends auth errors to the URL fragment). Client-only because the server
  // never sees the hash fragment.
  useEffect(() => {
    const queryError = searchParams.get("error");

    let hashErrorCode: string | null = null;
    let hashErrorDesc: string | null = null;
    if (typeof window !== "undefined" && window.location.hash) {
      const hashParams = new URLSearchParams(
        window.location.hash.replace(/^#/, ""),
      );
      hashErrorCode = hashParams.get("error_code") ?? hashParams.get("error");
      hashErrorDesc = hashParams.get("error_description");
      if (hashErrorDesc) {
        hashErrorDesc = decodeURIComponent(hashErrorDesc.replace(/\+/g, " "));
      }
    }

    if (queryError || hashErrorCode || hashErrorDesc) {
      setState({
        kind: "error",
        message: describeError(hashErrorCode, hashErrorDesc ?? queryError),
      });
      // Clean the URL so the error banner doesn't stick after the next attempt.
      if (typeof window !== "undefined" && window.location.hash) {
        const url = new URL(window.location.href);
        url.hash = "";
        url.searchParams.delete("error");
        window.history.replaceState(null, "", url.toString());
      }
    }
  }, [searchParams]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "sending" });

    const supabase = createClient();

    if (mode === "password") {
      // signInWithPassword sets the session client-side directly. The server
      // will pick it up via the Supabase auth cookie on the next request.
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setState({ kind: "error", message: error.message });
        return;
      }

      // Hard navigation so middleware and server components re-read the
      // freshly-issued session cookie. router.push alone keeps the prior
      // (unauthenticated) RSC payload cached.
      window.location.assign(next);
      return;
    }

    const callbackUrl = new URL("/auth/callback", window.location.origin);
    callbackUrl.searchParams.set("next", next);

    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: true,
      },
    });

    if (error) {
      setState({ kind: "error", message: error.message });
      return;
    }

    setState({ kind: "sent" });
  }

  if (state.kind === "sent") {
    return (
      <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-4 text-sm">
        <p className="font-medium">링크를 보냈습니다.</p>
        <p className="mt-1 text-neutral-600 dark:text-neutral-400">
          {email}으로 도착한 메일에서 로그인 버튼을 눌러주세요. 링크는 1시간
          동안만 유효합니다.
        </p>
      </div>
    );
  }

  return (
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

      {mode === "password" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">비밀번호</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
          />
        </label>
      )}

      {state.kind === "error" && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {state.message}
        </div>
      )}

      <button
        type="submit"
        disabled={state.kind === "sending"}
        className="w-full rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2.5 text-base font-medium disabled:opacity-50"
      >
        {state.kind === "sending"
          ? mode === "password"
            ? "로그인 중..."
            : "보내는 중..."
          : mode === "password"
            ? "로그인"
            : "로그인 링크 보내기"}
      </button>

      <button
        type="button"
        onClick={() => {
          setMode((m) => (m === "magic" ? "password" : "magic"));
          setPassword("");
          setState({ kind: "idle" });
        }}
        className="w-full text-center text-xs text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
      >
        {mode === "magic"
          ? "비밀번호로 로그인 (관리자)"
          : "매직링크로 로그인"}
      </button>
    </form>
  );
}
