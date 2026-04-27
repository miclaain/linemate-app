import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtKRW } from "@/lib/admin/format";
import { ParticipationForm } from "./form";
import { submitParticipation } from "./actions";

export default async function NewParticipationPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; error?: string }>;
}) {
  const { project: projectId, error } = await searchParams;
  if (!projectId) redirect("/mate");

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, client, period_start, period_end, default_unit_price, sub_rate",
    )
    .eq("id", projectId)
    .maybeSingle();

  if (!project) notFound();

  const period =
    project.period_start && project.period_end
      ? `${fmtDate(project.period_start)} ~ ${fmtDate(project.period_end)}`
      : project.period_start
        ? `${fmtDate(project.period_start)} ~`
        : project.period_end
          ? `~ ${fmtDate(project.period_end)}`
          : "기간 미정";

  // Default the date input to today, clamped to the project's period when
  // applicable. The form is client-side and re-validates on submit.
  const today = new Date().toISOString().slice(0, 10);
  const defaultDate =
    project.period_start && today < project.period_start
      ? project.period_start
      : project.period_end && today > project.period_end
        ? project.period_end
        : today;

  return (
    <div>
      <Link
        href="/mate"
        className="group mb-5 inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
      >
        <span className="inline-block transition-transform group-hover:-translate-x-1">
          ←
        </span>
        <span>프로젝트 목록</span>
      </Link>

      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl dark:border-neutral-800 dark:bg-neutral-900">
        {/* Header */}
        <div className="bg-gradient-to-br from-teal-500 via-teal-500 to-emerald-600 p-6">
          <span className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-xs text-teal-100">
            {period}
          </span>
          <h2 className="mt-2 text-lg font-bold leading-snug text-white">
            {project.name}
          </h2>
          {project.client && (
            <p className="mt-1 text-sm text-teal-100">📍 {project.client}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="rounded-lg bg-white/20 px-2.5 py-1 font-semibold text-white">
              메인 {fmtKRW(project.default_unit_price)}
            </span>
            {project.sub_rate !== null && (
              <span className="rounded-lg bg-white/15 px-2.5 py-1 font-semibold text-teal-100">
                보조 {fmtKRW(project.sub_rate)}
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
              {decodeURIComponent(error)}
            </div>
          )}
          <ParticipationForm
            projectId={project.id}
            defaultDate={defaultDate}
            mainRate={Number(project.default_unit_price)}
            subRate={
              project.sub_rate !== null ? Number(project.sub_rate) : null
            }
            action={submitParticipation}
          />
        </div>
      </div>
    </div>
  );
}
