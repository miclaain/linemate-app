import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate, fmtKRW } from "@/lib/admin/format";

export default async function ProjectsListPage() {
  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("projects")
    .select("id, name, client, period_start, period_end, default_unit_price, created_at")
    .order("created_at", { ascending: false });

  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    client: string | null;
    period_start: string | null;
    period_end: string | null;
    default_unit_price: number;
    created_at: string;
  }>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">프로젝트</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            워크숍·출강 프로젝트 마스터.
          </p>
        </div>
        <Link
          href="/admin/projects/new"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
        >
          + 새 프로젝트
        </Link>
      </header>

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          조회 실패: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
          등록된 프로젝트가 없습니다.{" "}
          <Link
            href="/admin/projects/new"
            className="underline hover:no-underline"
          >
            첫 프로젝트 만들기
          </Link>
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">프로젝트명</th>
                <th className="px-4 py-3 font-medium">발주처</th>
                <th className="px-4 py-3 font-medium">기간</th>
                <th className="px-4 py-3 font-medium text-right">기본 단가</th>
                <th className="px-4 py-3 font-medium">생성일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-neutral-50 dark:hover:bg-neutral-900"
                >
                  <td className="px-4 py-3 font-medium">
                    <Link
                      href={`/admin/projects/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {row.client ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {row.period_start || row.period_end
                      ? `${fmtDate(row.period_start)} ~ ${fmtDate(row.period_end)}`
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {fmtKRW(row.default_unit_price)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {fmtDate(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
