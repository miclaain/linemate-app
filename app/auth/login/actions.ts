"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type LoginResult = { ok: true } | { ok: false; error: string };

/**
 * Name-only mate login.
 *
 * Flow:
 *   1. SECURITY DEFINER RPC `resolve_linemate_for_login(name)` returns the
 *      auth email iff exactly one active linemate matches the name.
 *   2. service_role generates a one-time magic-link token (no email sent).
 *   3. Cookie-bound server client immediately verifies the token, which
 *      writes the auth session cookies for this request.
 *
 * Failed lookups (unmatched / ambiguous) are logged via `request_login`
 * RPC so admins can see attempted access and follow up out-of-band.
 *
 * SECURITY: this is intentionally weak — anyone who knows a mate's name
 * can log in as them. Acceptable for the internal tool / small trusted
 * group; revisit if user base grows or sensitivity increases.
 */
export async function loginByName(
  formData: FormData,
): Promise<LoginResult> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { ok: false, error: "이름을 입력해주세요." };
  if (name.length > 100) return { ok: false, error: "이름이 너무 깁니다." };

  const supabase = await createClient();

  // 1. Resolve name -> email. Returns NULL when 0 or 2+ active matches.
  const { data: email, error: lookupErr } = await supabase.rpc(
    "resolve_linemate_for_login",
    { p_name: name },
  );

  if (lookupErr) {
    return { ok: false, error: `로그인 실패: ${lookupErr.message}` };
  }

  if (!email || typeof email !== "string") {
    // Log the failed attempt for admin audit before returning a generic
    // error. Best-effort — ignore errors from the audit insert.
    try {
      await supabase.rpc("request_login", { p_name: name });
    } catch {
      // ignore
    }
    return {
      ok: false,
      error:
        "이름을 다시 확인해주세요. 동명이인이거나 가입 승인 전이라면 관리자에게 문의해주세요.",
    };
  }

  // 2. Generate a one-time magic-link token via service_role.
  const admin = createAdminClient();
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });

  const tokenHash = linkData?.properties?.hashed_token;
  if (linkErr || !tokenHash) {
    return {
      ok: false,
      error: `로그인 처리 중 오류가 발생했습니다${linkErr ? `: ${linkErr.message}` : ""}.`,
    };
  }

  // 3. Verify the OTP server-side. The cookie-bound client writes the
  //    Supabase session cookies onto this request's response.
  const { error: verifyErr } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "magiclink",
  });

  if (verifyErr) {
    return { ok: false, error: `로그인 실패: ${verifyErr.message}` };
  }

  return { ok: true };
}
