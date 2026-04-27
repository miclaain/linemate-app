"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";

function parseFormProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const client = String(formData.get("client") ?? "").trim();
  const periodStart = String(formData.get("period_start") ?? "").trim();
  const periodEnd = String(formData.get("period_end") ?? "").trim();
  const unitPriceRaw = String(formData.get("default_unit_price") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name) throw new Error("프로젝트명은 필수입니다.");

  const unitPrice = Number(unitPriceRaw);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error("기본 단가는 0 이상의 숫자여야 합니다.");
  }

  if (periodStart && periodEnd && periodStart > periodEnd) {
    throw new Error("시작일은 종료일보다 빠를 수 없습니다.");
  }

  return {
    name,
    client: client || null,
    period_start: periodStart || null,
    period_end: periodEnd || null,
    default_unit_price: unitPrice,
    notes: notes || null,
  };
}

export async function createProject(formData: FormData) {
  const payload = parseFormProject(formData);
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("projects")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(`생성 실패: ${error.message}`);

  revalidatePath("/admin/projects");
  revalidatePath("/admin");
  redirect(`/admin/projects/${data.id}?saved=1`);
}

export async function updateProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("missing id");

  const payload = parseFormProject(formData);
  const { supabase } = await requireAdmin();

  const { error } = await supabase.from("projects").update(payload).eq("id", id);
  if (error) throw new Error(`수정 실패: ${error.message}`);

  revalidatePath("/admin/projects");
  revalidatePath(`/admin/projects/${id}`);
  redirect(`/admin/projects/${id}?saved=1`);
}
