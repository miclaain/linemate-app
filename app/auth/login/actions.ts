"use server";

import { createClient } from "@/lib/supabase/server";

export type RequestResult =
  | { ok: true; resolved: "matched" | "ambiguous" | "unknown" }
  | { ok: false; error: string };

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Public RPC: mate types name on the login page, we record a login_request
 * row. The RPC resolves the name to an active linemate when unambiguous, but
 * always inserts a row so the admin sees attempted logins (including
 * unmatched/ambiguous) and can follow up via Kakao.
 */
export async function requestLoginByName(
  formData: FormData,
): Promise<RequestResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "이름을 입력해주세요." };
  if (name.length > 100) return { ok: false, error: "이름이 너무 깁니다." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_login", {
    p_name: name,
  });

  if (error) {
    return { ok: false, error: `요청 실패: ${error.message}` };
  }

  const result = data as { id: string; resolved: string } | null;
  return {
    ok: true,
    resolved: (result?.resolved ?? "unknown") as
      | "matched"
      | "ambiguous"
      | "unknown",
  };
}

/**
 * Public RPC + signInWithPassword. Looks up the active linemate by name (must
 * be unambiguous) via SECURITY DEFINER RPC, then authenticates with the PIN
 * the admin has issued out-of-band.
 *
 * On success the cookie-bound supabase client sets the session cookies; the
 * client should then hard-reload to /. On failure, returns a message safe to
 * show to the mate.
 */
export async function loginByNameAndPin(
  formData: FormData,
): Promise<LoginResult> {
  const name = String(formData.get("name") ?? "").trim();
  const pin = String(formData.get("pin") ?? "");

  if (!name || !pin) {
    return { ok: false, error: "이름과 PIN을 모두 입력해주세요." };
  }

  const supabase = await createClient();

  // Resolve name -> email via SECURITY DEFINER RPC. Returns null when 0 or
  // 2+ matches; we surface a generic error in both cases to avoid leaking
  // which names exist.
  const { data: email, error: lookupErr } = await supabase.rpc(
    "resolve_linemate_for_login",
    { p_name: name },
  );

  if (lookupErr) {
    return { ok: false, error: `로그인 실패: ${lookupErr.message}` };
  }

  if (!email || typeof email !== "string") {
    return {
      ok: false,
      error:
        "이름 또는 PIN이 올바르지 않습니다. 동명이인이거나 가입 승인 전이라면 관리자에게 문의해주세요.",
    };
  }

  const { error: signInErr } = await supabase.auth.signInWithPassword({
    email,
    password: pin,
  });

  if (signInErr) {
    return { ok: false, error: "이름 또는 PIN이 올바르지 않습니다." };
  }

  return { ok: true };
}
