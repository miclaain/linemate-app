"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function submitParticipation(formData: FormData) {
  const projectId = String(formData.get("project_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const role = String(formData.get("role") ?? "").trim();
  const unitPriceRaw = String(formData.get("unit_price") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();

  if (!projectId || !date || !role) {
    redirect(
      `/mate/participations/new?project=${projectId}&error=${encodeURIComponent("필수 항목이 비어있습니다.")}`,
    );
  }

  const unitPrice = Number(unitPriceRaw);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    redirect(
      `/mate/participations/new?project=${projectId}&error=${encodeURIComponent("금액은 0 이상의 숫자여야 합니다.")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // RLS policy `participations_insert_self` enforces:
  //   status='pending', linemate_id=auth.uid(), linemates.status='active'
  const { error } = await supabase.from("participations").insert({
    linemate_id: user.id,
    project_id: projectId,
    date,
    role,
    unit_price: unitPrice,
    notes: note || null,
    status: "pending",
  });

  if (error) {
    redirect(
      `/mate/participations/new?project=${projectId}&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath("/mate");
  revalidatePath("/mate/participations");
  redirect("/mate/participations?submitted=1");
}
