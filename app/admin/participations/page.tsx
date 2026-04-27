import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate, fmtKRW, currentYearMonth } from "@/lib/admin/format";
import {
  StatusBadge,
  participationStatusLabel,
  participationStatusVariant,
} from "@/components/admin/status-badge";

type StatusFilter = "all" | "pending" | "approved" | "rejected";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "대기" },
  { value: "approved", label: "승인" },
  { value: "rejected", label: "거절" },
  { value: "all", label: "전체" },
];

function ymRange(ym: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const next = new Date(Date.UTC(y, m, 1));
  const last = new Date(next.getTime() - 86400000);
  const end = last.toISOString().slice(0, 10);
  return { start, end };
}

export default async function ParticipationsListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    month?: string;
    project?: string;
    linemate?: string;
  }>;
}) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;

  const status: StatusFilter =
    sp.status === "approved" ||
    sp.status === "rejected" ||
    sp.status === "all" ||
    sp.status === "pending"
      ? sp.status
      : "pending";

  const month = sp.month ?? "";
  const projectId = sp.project ?? "";
  const linemateId = sp.linemate ?? "";

  // Filter dropdowns: load active linemates and all projects.
  const [linematesRes, projectsRes] = await Promise.all([
    supabase
      .from("linemates")
      .select("id, name")
      .in("status", ["active", "inactive"])
      .order("name"),
    supabase.from("projects").select("id, name").order("created_at", {
      ascending: false,
    }),
  ]);

  let query = supabase
    .from("participations")
    .select(
      "id, date, role, hours, unit_price, status, locked, submitted_at, linemates(id, name), projects(id, name, default_unit_price)",
    )
    .order("date", { ascending: false })
    .order("submitted_at", { ascending: false })
    .limit(200);

  if (status !== "all") query = query.eq("status", status);
  if (projectId) query = query.eq("project_id", projectId);
  if (linemateId) query = query.eq("linemate_id", linemateId);
  if (month) {
    const r = ymRange(month);
    if (r) {
      query = query.gte("date", r.start).lte("date", r.end);
    }
  }

  const { data, error } = await query;
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    date: string;
    role: string | null;
    hours: number | null;
    unit_price: number | null;
    status: string;
    locked: boolean;
    submitted_at: string;
    linemates: { id: string; name: string } | null;
    projects: { id: string; name: string; default_unit_price: number } | null;
  }>;

  const buildHref = (next: Partial<{ status: string; month: string; project: string; linemate: string }>) => {
    const params = new URLSearchParams();
    const merged = {
      status: next.status ?? status,
      month: next.month ?? month,
      project: next.project ?? projectId,
      linemate: next.linemate ?? linemateId,
    };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "pending") params.set(k, v);
      if (k === "status" && v === "pending") {
        // pending is the default, omit from URL for clean canonical
      }
    }
    const qs = params.toString();
    return qs ? `/admin/participations?${qs}` : "/admin/participations";
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">참여 내역</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          라인메이트 제출 내역. 마감된 월(🔒)은 수정 불가.
        </p>
      </header>

      <nav className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={buildHref({ status: tab.value })}
              className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
                active
                  ? "border-neutral-900 dark:border-neutral-100 font-medium"
                  : "border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <form
        method="get"
        className="grid grid-cols-1 gap-3 rounded-lg border border-neutral-200 dark:border-neutral-800 p-4 sm:grid-cols-4"
      >
        <input type="hidden" name="status" value={status} />
        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">월 (YYYY-MM)</span>
          <input
            type="month"
            name="month"
            defaultValue={month}
            placeholder={currentYearMonth()}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">프로젝트</span>
          <select
            name="project"
            defaultValue={projectId}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {(projectsRes.data ?? []).map((p: { id: string; name: string }) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-neutral-500">라인메이트</span>
          <select
            name="linemate"
            defaultValue={linemateId}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
          >
            <option value="">전체</option>
            {(linematesRes.data ?? []).map((l: { id: string; name: string }) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end gap-2">
          <button
            type="submit"
            className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-3 py-1.5 text-sm"
          >
            적용
          </button>
          <Link
            href={`/admin/participations${status !== "pending" ? `?status=${status}` : ""}`}
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm"
          >
            초기화
          </Link>
        </div>
      </form>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          조회 실패: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
          조건에 맞는 참여 내역이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">날짜</th>
                <th className="px-4 py-3 font-medium">라인메이트</th>
                <th className="px-4 py-3 font-medium">프로젝트</th>
                <th className="px-4 py-3 font-medium">역할</th>
                <th className="px-4 py-3 font-medium text-right">시간</th>
                <th className="px-4 py-3 font-medium text-right">단가</th>
                <th className="px-4 py-3 font-medium">상태</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((p) => {
                const effective =
                  p.unit_price ?? p.projects?.default_unit_price ?? null;
                return (
                  <tr
                    key={p.id}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/participations/${p.id}`}
                        className="hover:underline"
                      >
                        {fmtDate(p.date)}
                      </Link>
                    </td>
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
                    <td className="px-4 py-3">
                      {p.projects ? (
                        <Link
                          href={`/admin/projects/${p.projects.id}`}
                          className="hover:underline"
                        >
                          {p.projects.name}
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
                        <span className="mr-1 text-xs text-neutral-500" title="마감 잠금">
                          🔒
                        </span>
                      )}
                      <StatusBadge variant={participationStatusVariant(p.status)}>
                        {participationStatusLabel(p.status)}
                      </StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
