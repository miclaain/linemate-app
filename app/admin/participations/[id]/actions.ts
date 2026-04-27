"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";

async function ensureNotLocked(id: string) {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase
    .from("participations")
    .select("locked")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`조회 실패: ${error.message}`);
  if (!data) throw new Error("참여 내역을 찾을 수 없습니다.");
  if (data.locked) {
    throw new Error("마감된 월의 참여 내역은 수정할 수 없습니다.");
  }
  return supabase;
}

export async function approveParticipation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const supabase = await ensureNotLocked(id);
  const { user } = await requireAdmin();

  const { error } = await supabase
    .from("participations")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: user.id,
      reject_reason: null,
    })
    .eq("id", id);

  if (error) throw new Error(`승인 실패: ${error.message}`);

  revalidatePath("/admin/participations");
  revalidatePath(`/admin/participations/${id}`);
  revalidatePath("/admin");
}

export async function rejectParticipation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const reason = String(formData.get("reject_reason") ?? "").trim();
  if (!reason) throw new Error("거절 사유를 입력해주세요.");

  const supabase = await ensureNotLocked(id);

  const { error } = await supabase
    .from("participations")
    .update({
      status: "rejected",
      reject_reason: reason,
    })
    .eq("id", id);

  if (error) throw new Error(`거절 실패: ${error.message}`);

  revalidatePath("/admin/participations");
  revalidatePath(`/admin/participations/${id}`);
  revalidatePath("/admin");
}

export async function updateParticipation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const supabase = await ensureNotLocked(id);

  const date = String(formData.get("date") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const hoursRaw = String(formData.get("hours") ?? "").trim();
  const unitPriceRaw = String(formData.get("unit_price") ?? "").trim();

  if (!date) throw new Error("날짜는 필수입니다.");

  let hours: number | null = null;
  if (hoursRaw) {
    hours = Number(hoursRaw);
    if (!Number.isFinite(hours) || hours <= 0) {
      throw new Error("시간은 양수여야 합니다.");
    }
  }

  let unitPrice: number | null = null;
  if (unitPriceRaw) {
    unitPrice = Number(unitPriceRaw);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error("단가는 0 이상의 숫자여야 합니다.");
    }
  }

  const { error } = await supabase
    .from("participations")
    .update({
      date,
      role: role || null,
      hours,
      unit_price: unitPrice,
    })
    .eq("id", id);

  if (error) throw new Error(`수정 실패: ${error.message}`);

  revalidatePath(`/admin/participations/${id}`);
  revalidatePath("/admin/participations");
  redirect(`/admin/participations/${id}?saved=1`);
}
