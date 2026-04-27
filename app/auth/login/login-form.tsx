"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loginByName } from "./actions";

type Mode = "name" | "password" | "magic";

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

  // Default to `name` — most users are mates who log in with name only.
  // `password` (email + password) is for admin. `magic` (email link) is
  // a fallback.
  const [mode, setMode] = useState<Mode>("name");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "sent" } // magic link sent
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

  function switchMode(m: Mode) {
    setMode(m);
    setPassword("");
    setState({ kind: "idle" });
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState({ kind: "sending" });

    if (mode === "name") {
      const fd = new FormData();
      fd.set("name", name.trim());
      const result = await loginByName(fd);
      if (!result.ok) {
        setState({ kind: "error", message: result.error });
        return;
      }
      window.location.assign(next);
      return;
    }

    const supabase = createClient();

    if (mode === "password") {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setState({ kind: "error", message: error.message });
        return;
      }
      window.location.assign(next);
      return;
    }

    // magic
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

  // ── Sent (magic link) screen ──────────────────────────────────────────
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
      {mode === "name" && (
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">이름</span>
          <input
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-base outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-100"
          />
        </label>
      )}

      {mode === "password" && (
        <>
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
        </>
      )}

      {mode === "magic" && (
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
          ? mode === "magic"
            ? "보내는 중..."
            : "로그인 중..."
          : mode === "magic"
            ? "로그인 링크 보내기"
            : "로그인"}
      </button>

      <div className="flex justify-center gap-3 pt-1 text-xs text-neutral-500 dark:text-neutral-400">
        {mode !== "name" && (
          <button
            type="button"
            onClick={() => switchMode("name")}
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            이름으로 로그인
          </button>
        )}
        {mode !== "password" && (
          <button
            type="button"
            onClick={() => switchMode("password")}
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            관리자 로그인
          </button>
        )}
        {mode !== "magic" && (
          <button
            type="button"
            onClick={() => switchMode("magic")}
            className="hover:text-neutral-900 dark:hover:text-neutral-100"
          >
            이메일 링크
          </button>
        )}
      </div>
    </form>
  );
}
