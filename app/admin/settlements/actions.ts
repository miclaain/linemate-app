"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";

export async function finalizeMonth(formData: FormData) {
  const ym = String(formData.get("year_month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw new Error("월 형식이 올바르지 않습니다 (YYYY-MM).");
  }

  const { supabase } = await requireAdmin();

  // RPC enforces admin role + idempotency + locks rows + inserts settlements.
  const { error } = await supabase.rpc("finalize_month", { p_year_month: ym });
  if (error) throw new Error(`마감 실패: ${error.message}`);

  revalidatePath("/admin/settlements");
  revalidatePath(`/admin/settlements/${ym}`);
  revalidatePath("/admin/participations");
  revalidatePath("/admin");

  redirect(`/admin/settlements/${ym}?finalized=1`);
}

export async function markExported(formData: FormData) {
  const ym = String(formData.get("year_month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    throw new Error("월 형식이 올바르지 않습니다.");
  }

  const { supabase } = await requireAdmin();

  const { error } = await supabase
    .from("settlements")
    .update({ exported_at: new Date().toISOString() })
    .eq("year_month", ym);

  if (error) throw new Error(`기록 실패: ${error.message}`);

  revalidatePath(`/admin/settlements/${ym}`);
  revalidatePath("/admin/settlements");
}
