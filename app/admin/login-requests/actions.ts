"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";

/**
 * Mark a failed/abandoned login attempt as handled. With the PIN flow
 * retired, login_requests now functions purely as an audit log of
 * unmatched/ambiguous name lookups; admin reviews the row and dismisses it.
 */
export async function dismissLoginRequest(formData: FormData) {
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

  if (error) throw new Error(`처리 실패: ${error.message}`);

  revalidatePath("/admin/login-requests");
  revalidatePath("/admin");
}
