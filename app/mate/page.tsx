import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtKRW } from "@/lib/admin/format";

export default async function MateHome() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Layout already enforces auth + active linemate. user is guaranteed.
  const linemateId = user!.id;

  // Active projects (no end date OR end date >= today). Mate sees all.
  const today = new Date().toISOString().slice(0, 10);
  const { data: projects } = await supabase
    .from("projects")
    .select(
      "id, name, client, period_start, period_end, default_unit_price, sub_rate",
    )
    .or(`period_end.is.null,period_end.gte.${today}`)
    .order("period_start", { ascending: false, nullsFirst: false })
    .limit(50);

  // My recent participations to flag which projects I've already submitted to.
  const { data: myParts } = await supabase
    .from("participations")
    .select("id, project_id, date, role, unit_price, status")
    .eq("linemate_id", linemateId)
    .order("date", { ascending: false })
    .limit(50);

  const partRows = myParts ?? [];
  const submittedProjectIds = new Set(partRows.map((p) => p.project_id));

  const monthSubmissions = partRows.filter((p) => {
    const ym = p.date?.slice(0, 7);
    const today = new Date();
    const cur = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
    return ym === cur;
  });

  const pendingProjects = (projects ?? []).filter(
    (p) => !submittedProjectIds.has(p.id),
  );
  const submittedProjects = (projects ?? []).filter((p) =>
    submittedProjectIds.has(p.id),
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
          참여할 프로젝트를 선택하세요 👋
        </h1>
        <p className="mt-0.5 text-sm text-gray-400">
          카드를 누르면 정산을 등록할 수 있어요.
        </p>
      </header>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 dark:border-amber-900/30 dark:bg-amber-950/20">
          <p className="text-xs font-bold text-amber-600">미제출 프로젝트</p>
          <p className="mt-0.5 text-2xl font-black text-amber-700">
            {pendingProjects.length}건
          </p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 dark:border-emerald-900/30 dark:bg-emerald-950/20">
          <p className="text-xs font-bold text-emerald-600">이번 달 제출</p>
          <p className="mt-0.5 text-2xl font-black text-emerald-700">
            {monthSubmissions.length}건
          </p>
        </div>
      </section>

      {/* Workshop cards */}
      {(projects ?? []).length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-neutral-800">
          <div className="mb-3 text-4xl">📋</div>
          <p className="text-sm font-medium text-gray-400">
            진행 중인 프로젝트가 없습니다.
          </p>
        </div>
      ) : (
        <section className="space-y-4">
          {pendingProjects.length > 0 && (
            <>
              <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
                미제출
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {pendingProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} submitted={false} />
                ))}
              </div>
            </>
          )}

          {submittedProjects.length > 0 && (
            <>
              <h2 className="pt-4 text-xs font-black uppercase tracking-widest text-gray-400">
                제출됨
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {submittedProjects.map((p) => (
                  <ProjectCard key={p.id} project={p} submitted />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Recent submissions */}
      <section className="pt-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-xs font-black uppercase tracking-widest text-gray-400">
            최근 제출 내역
          </h2>
          <Link
            href="/mate/participations"
            className="text-xs font-bold text-teal-600 hover:underline"
          >
            전체 보기 →
          </Link>
        </div>
        {partRows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-xs text-gray-400 dark:border-neutral-800">
            아직 제출한 정산이 없습니다.
          </p>
        ) : (
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:divide-neutral-800 dark:border-neutral-800 dark:bg-neutral-900">
            {partRows.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-gray-800 dark:text-neutral-200">
                    {(projects ?? []).find((proj) => proj.id === p.project_id)
                      ?.name ?? "(삭제된 프로젝트)"}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {fmtDate(p.date)} · {p.role ?? "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-gray-800 dark:text-neutral-200">
                    {fmtKRW(p.unit_price)}
                  </p>
                  <p
                    className={`mt-0.5 text-xs font-bold ${
                      p.status === "approved"
                        ? "text-emerald-600"
                        : p.status === "rejected"
                          ? "text-red-600"
                          : "text-amber-600"
                    }`}
                  >
                    {p.status === "approved"
                      ? "승인"
                      : p.status === "rejected"
                        ? "반려"
                        : "검토중"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ProjectCard({
  project,
  submitted,
}: {
  project: {
    id: string;
    name: string;
    client: string | null;
    period_start: string | null;
    period_end: string | null;
    default_unit_price: number;
    sub_rate: number | null;
  };
  submitted: boolean;
}) {
  const period =
    project.period_start && project.period_end
      ? `${fmtDate(project.period_start)} ~ ${fmtDate(project.period_end)}`
      : project.period_start
        ? `${fmtDate(project.period_start)} ~`
        : project.period_end
          ? `~ ${fmtDate(project.period_end)}`
          : "기간 미정";

  return (
    <Link
      href={`/mate/participations/new?project=${project.id}`}
      className={`block rounded-2xl border-2 p-5 transition-all ${
        submitted
          ? "border-gray-100 bg-gray-50 opacity-70 dark:border-neutral-800 dark:bg-neutral-900"
          : "border-gray-200 bg-white hover:-translate-y-0.5 hover:border-teal-400 hover:shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
      }`}
    >
      <div className="mb-3 flex items-start justify-between">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
            submitted
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {submitted ? "✓ 제출됨" : "⏳ 입력 대기"}
        </span>
        <span className="rounded-lg bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-400 dark:bg-neutral-800">
          {period}
        </span>
      </div>
      <h3 className="mb-2 text-sm font-bold leading-snug text-gray-900 dark:text-neutral-100">
        {project.name}
      </h3>
      {project.client && (
        <p className="mb-3 text-xs text-gray-400">📍 {project.client}</p>
      )}
      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3 text-xs dark:border-neutral-800">
        <span className="rounded-lg bg-teal-50 px-2.5 py-1 font-semibold text-teal-700 dark:bg-teal-950/30 dark:text-teal-300">
          메인 {fmtKRW(project.default_unit_price)}
        </span>
        {project.sub_rate !== null && (
          <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-600 dark:bg-neutral-800 dark:text-neutral-400">
            보조 {fmtKRW(project.sub_rate)}
          </span>
        )}
      </div>
    </Link>
  );
}
