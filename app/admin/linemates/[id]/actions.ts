"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";

/**
 * Approve a linemate (status pending|inactive → active).
 * Stamps approved_at + approved_by from the current admin.
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

  revalidatePath("/admin/linemates");
  revalidatePath(`/admin/linemates/${id}`);
  revalidatePath("/admin");
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
