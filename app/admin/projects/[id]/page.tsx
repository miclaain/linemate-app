import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate, fmtDateTime, fmtKRW } from "@/lib/admin/format";
import {
  StatusBadge,
  participationStatusLabel,
  participationStatusVariant,
} from "@/components/admin/status-badge";
import { ProjectForm } from "@/components/admin/project-form";
import { updateProject } from "../actions";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client, period_start, period_end, default_unit_price, sub_rate, notes, created_at")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const { data: parts } = await supabase
    .from("participations")
    .select(
      "id, date, role, hours, unit_price, status, locked, linemates(id, name)",
    )
    .eq("project_id", id)
    .order("date", { ascending: false })
    .limit(50);

  const partRows = (parts ?? []) as unknown as Array<{
    id: string;
    date: string;
    role: string | null;
    hours: number | null;
    unit_price: number | null;
    status: string;
    locked: boolean;
    linemates: { id: string; name: string } | null;
  }>;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/projects"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 프로젝트 목록
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          {project.client ?? "발주처 미지정"} · 기본 단가{" "}
          {fmtKRW(project.default_unit_price)} · 생성{" "}
          {fmtDate(project.created_at)}
        </p>
      </header>

      {saved === "1" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          저장되었습니다.
        </p>
      )}

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="mb-4 text-sm font-medium">프로젝트 수정</h2>
        <ProjectForm action={updateProject} project={project} submitLabel="저장" />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">
          참여 내역 (최대 50건, 최신순)
        </h2>
        {partRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            아직 참여 등록이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">라인메이트</th>
                  <th className="px-4 py-3 font-medium">역할</th>
                  <th className="px-4 py-3 font-medium text-right">시간</th>
                  <th className="px-4 py-3 font-medium text-right">단가</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">제출 시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {partRows.map((p) => {
                  const effective = p.unit_price ?? project.default_unit_price;
                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <td className="px-4 py-3">{fmtDate(p.date)}</td>
                      <td className="px-4 py-3">
                        {p.linemates ? (
                          <Link
                            href={`/admin/linemates/${p.linemates.id}`}
                            className="hover:underline"
                          >
                            {p.linemates.name}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {p.role ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {p.hours ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtKRW(effective)}
                      </td>
                      <td className="px-4 py-3">
                        {p.locked && (
                          <span className="mr-1 text-xs text-neutral-500">
                            🔒
                          </span>
                        )}
                        <Link
                          href={`/admin/participations/${p.id}`}
                          className="hover:underline"
                        >
                          <StatusBadge variant={participationStatusVariant(p.status)}>
                            {participationStatusLabel(p.status)}
                          </StatusBadge>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {fmtDateTime(p.date)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
