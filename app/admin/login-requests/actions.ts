"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient, generatePin } from "@/lib/supabase/admin";

/**
 * Issue a fresh PIN for the resolved linemate of a login request and mark
 * the request handled. PIN is surfaced via redirect flash param so admin
 * can copy it and forward via Kakao.
 *
 * Requires the request to have a resolved linemate_id — ambiguous/unknown
 * requests can't be auto-issued; admin uses cancelLoginRequest + manually
 * resets PIN on the linemate page after disambiguating.
 */
export async function issuePinForRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) throw new Error("missing request_id");

  const { user, supabase } = await requireAdmin();

  const { data: req, error: fetchErr } = await supabase
    .from("login_requests")
    .select("id, linemate_id, status")
    .eq("id", requestId)
    .maybeSingle();

  if (fetchErr) throw new Error(`조회 실패: ${fetchErr.message}`);
  if (!req) throw new Error("요청을 찾을 수 없습니다.");
  if (req.status !== "pending") {
    redirect("/admin/login-requests?error=already_handled");
  }
  if (!req.linemate_id) {
    redirect("/admin/login-requests?error=unresolved");
  }

  const pin = generatePin();
  const admin = createAdminClient();
  const { error: pwErr } = await admin.auth.admin.updateUserById(
    req.linemate_id,
    { password: pin },
  );

  if (pwErr) {
    redirect(
      `/admin/login-requests?error=${encodeURIComponent(pwErr.message)}`,
    );
  }

  const { error: updateErr } = await supabase
    .from("login_requests")
    .update({
      status: "pin_sent",
      handled_by: user.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateErr) {
    // PIN was set but request status couldn't be updated; admin can re-issue.
    redirect(
      `/admin/login-requests?error=${encodeURIComponent(updateErr.message)}`,
    );
  }

  revalidatePath("/admin/login-requests");
  revalidatePath("/admin");
  revalidatePath(`/admin/linemates/${req.linemate_id}`);
  redirect(`/admin/login-requests?pin=${pin}&linemate=${req.linemate_id}`);
}

/** Dismiss a login request without issuing a PIN. */
export async function cancelLoginRequest(formData: FormData) {
  const requestId = String(formData.get("request_id") ?? "");
  if (!requestId) throw new Error("missing request_id");

  const { user, supabase } = await requireAdmin();

  const { error } = await supabase
    .from("login_requests")
    .update({
      status: "cancelled",
      handled_by: user.id,
      handled_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (error) throw new Error(`취소 실패: ${error.message}`);

  revalidatePath("/admin/login-requests");
  revalidatePath("/admin");
}
