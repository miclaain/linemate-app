"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient, generatePin } from "@/lib/supabase/admin";

/**
 * Approve a linemate (status pending|inactive → active) and issue a 6-digit
 * login PIN. The PIN is set as the user's auth password via service_role and
 * surfaced to the admin via redirect query param so they can hand it off
 * (Kakao, etc.). Same flow re-runs if approved again from inactive.
 */
export async function approveLinemate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const { user, supabase } = await requireAdmin();

  const { error } = await supabase
    .from("linemates")
    .update({
      status: "active",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
    })
    .eq("id", id);

  if (error) throw new Error(`승인 실패: ${error.message}`);

  // Issue PIN. Failure here shouldn't roll back approval — admin can re-issue
  // from the detail page. Surface the PIN via flash query param.
  const pin = generatePin();
  const admin = createAdminClient();
  const { error: pinErr } = await admin.auth.admin.updateUserById(id, {
    password: pin,
  });

  revalidatePath("/admin/linemates");
  revalidatePath(`/admin/linemates/${id}`);
  revalidatePath("/admin");

  if (pinErr) {
    redirect(`/admin/linemates/${id}?pin_error=${encodeURIComponent(pinErr.message)}`);
  }
  redirect(`/admin/linemates/${id}?pin=${pin}`);
}

/**
 * Re-issue a fresh login PIN. Used when a linemate forgets theirs or when an
 * already-active linemate needs a password set for the first time. Returns
 * the PIN via redirect flash param.
 */
export async function resetLinematePin(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  await requireAdmin();

  const pin = generatePin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: pin,
  });

  if (error) {
    redirect(`/admin/linemates/${id}?pin_error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/admin/linemates/${id}`);
  redirect(`/admin/linemates/${id}?pin=${pin}`);
}

/**
 * Deactivate a linemate (any → inactive). Used both for rejecting pending
 * applicants and disabling existing active linemates.
 */
export async function deactivateLinemate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("linemates")
    .update({ status: "inactive" })
    .eq("id", id);

  if (error) throw new Error(`비활성화 실패: ${error.message}`);

  revalidatePath("/admin/linemates");
  revalidatePath(`/admin/linemates/${id}`);
  revalidatePath("/admin");
}

/**
 * Update editable fields (name, phone, role_default).
 * Status is changed only via approve/deactivate.
 */
export async function updateLinemateProfile(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const roleDefault = String(formData.get("role_default") ?? "").trim();

  if (!name) throw new Error("이름은 필수입니다.");

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("linemates")
    .update({
      name,
      phone: phone || null,
      role_default: roleDefault || null,
    })
    .eq("id", id);

  if (error) throw new Error(`수정 실패: ${error.message}`);

  revalidatePath(`/admin/linemates/${id}`);
  revalidatePath("/admin/linemates");
  redirect(`/admin/linemates/${id}?saved=1`);
}
