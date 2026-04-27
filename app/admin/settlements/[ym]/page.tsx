import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate, fmtDateTime, fmtKRW } from "@/lib/admin/format";
import { finalizeMonth, markExported } from "../actions";

function ymRange(ym: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const next = new Date(Date.UTC(y, m, 1));
  const last = new Date(next.getTime() - 86400000);
  const end = last.toISOString().slice(0, 10);
  return { start, end };
}

export default async function MonthDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ym: string }>;
  searchParams: Promise<{ finalized?: string }>;
}) {
  const { ym } = await params;
  const { finalized: justFinalized } = await searchParams;

  if (!/^\d{4}-\d{2}$/.test(ym)) notFound();
  const range = ymRange(ym)!;

  const { supabase } = await requireAdmin();

  // Settlements rows for this month (if finalized).
  const { data: settlementsData } = await supabase
    .from("settlements")
    .select(
      "id, year_month, total_amount, finalized_at, finalized_by, exported_at, linemates(id, name, email)",
    )
    .eq("year_month", ym)
    .order("total_amount", { ascending: false });

  type SettlementRow = {
    id: string;
    year_month: string;
    total_amount: number;
    finalized_at: string;
    finalized_by: string;
    exported_at: string | null;
    linemates: { id: string; name: string; email: string } | null;
  };
  const finalRows = (settlementsData ?? []) as unknown as SettlementRow[];
  const isFinalized = finalRows.length > 0;

  // If not finalized, show draft (per-linemate aggregation of approved parts).
  // If finalized, also show participation breakdown for transparency.
  const { data: partsData } = await supabase
    .from("participations")
    .select(
      "id, date, role, hours, unit_price, status, locked, linemates(id, name), projects(id, name, default_unit_price)",
    )
    .gte("date", range.start)
    .lte("date", range.end)
    .order("date", { ascending: true });

  type PartRow = {
    id: string;
    date: string;
    role: string | null;
    hours: number | null;
    unit_price: number | null;
    status: string;
    locked: boolean;
    linemates: { id: string; name: string } | null;
    projects: { id: string; name: string; default_unit_price: number } | null;
  };
  const partRows = (partsData ?? []) as unknown as PartRow[];

  // Draft aggregation (only used when not finalized).
  const draftByLinemate = new Map<
    string,
    { name: string; total: number; rows: number }
  >();
  for (const p of partRows) {
    if (p.status !== "approved") continue;
    if (!p.linemates) continue;
    const price = p.unit_price ?? p.projects?.default_unit_price ?? 0;
    const cur = draftByLinemate.get(p.linemates.id);
    if (cur) {
      cur.total += Number(price);
      cur.rows += 1;
    } else {
      draftByLinemate.set(p.linemates.id, {
        name: p.linemates.name,
        total: Number(price),
        rows: 1,
      });
    }
  }
  const draftRows = Array.from(draftByLinemate.entries())
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.total - a.total);

  const totalSum = isFinalized
    ? finalRows.reduce((s, r) => s + Number(r.total_amount), 0)
    : draftRows.reduce((s, r) => s + r.total, 0);

  const pendingCount = partRows.filter((p) => p.status === "pending").length;

  const meta = isFinalized
    ? {
        finalizedAt: finalRows[0].finalized_at,
        exportedAt: finalRows[0].exported_at,
      }
    : null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/settlements"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 정산 관리
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ym} 정산
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {fmtDate(range.start)} ~ {fmtDate(range.end)}
          </p>
          <div className="mt-2">
            {isFinalized ? (
              <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                마감 완료 · {fmtDateTime(meta!.finalizedAt)}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                미마감 (실시간 집계)
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          {isFinalized ? (
            <>
              <a
                href={`/admin/settlements/${ym}/export`}
                className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-900"
              >
                CSV 다운로드
              </a>
              {!meta!.exportedAt && (
                <form action={markExported}>
                  <input type="hidden" name="year_month" value={ym} />
                  <button
                    type="submit"
                    className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm"
                  >
                    송금 완료 표시
                  </button>
                </form>
              )}
              {meta!.exportedAt && (
                <span className="text-xs text-neutral-500">
                  송금 완료: {fmtDate(meta!.exportedAt)}
                </span>
              )}
            </>
          ) : (
            <form action={finalizeMonth}>
              <input type="hidden" name="year_month" value={ym} />
              <button
                type="submit"
                className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
              >
                {ym} 마감 실행
              </button>
            </form>
          )}
        </div>
      </header>

      {justFinalized === "1" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          마감 완료. 해당 월 참여 내역은 잠금 처리되었습니다.
        </p>
      )}

      {!isFinalized && pendingCount > 0 && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          이 월에는 대기 중인 참여 {pendingCount}건이 있습니다. 마감하면 포함되지 않습니다.{" "}
          <Link
            href={`/admin/participations?status=pending&month=${ym}`}
            className="underline hover:no-underline"
          >
            먼저 처리하기
          </Link>
        </p>
      )}

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-medium">라인메이트별 합계</h2>
          <p className="text-2xl font-semibold tabular-nums">
            {fmtKRW(totalSum)}
          </p>
        </div>

        {isFinalized ? (
          finalRows.length === 0 ? (
            <p className="mt-4 text-sm text-neutral-500">대상 라인메이트 없음.</p>
          ) : (
            <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">라인메이트</th>
                    <th className="px-4 py-2 font-medium">이메일</th>
                    <th className="px-4 py-2 font-medium text-right">합계</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                  {finalRows.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-2">
                        {r.linemates ? (
                          <Link
                            href={`/admin/linemates/${r.linemates.id}`}
                            className="hover:underline"
                          >
                            {r.linemates.name}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                        {r.linemates?.email ?? "-"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums font-medium">
                        {fmtKRW(r.total_amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : draftRows.length === 0 ? (
          <p className="mt-4 text-sm text-neutral-500">
            승인된 참여 내역이 없습니다.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-md border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2 font-medium">라인메이트</th>
                  <th className="px-4 py-2 font-medium text-right">건수</th>
                  <th className="px-4 py-2 font-medium text-right">합계 (예상)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {draftRows.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2">
                      <Link
                        href={`/admin/linemates/${r.id}`}
                        className="hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {r.rows}
                    </td>
                    <td className="px-4 py-2 text-right tabular-nums font-medium">
                      {fmtKRW(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">참여 내역 상세</h2>
        {partRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            이 월에 등록된 참여 내역이 없습니다.
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
                  <th className="px-4 py-3 font-medium text-right">단가</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {partRows.map((p) => {
                  const effective =
                    p.unit_price ?? p.projects?.default_unit_price ?? null;
                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-neutral-50 dark:hover:bg-neutral-900 ${
                        p.status === "rejected" ? "opacity-60" : ""
                      }`}
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
                        {p.linemates?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3">
                        {p.projects?.name ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {p.role ?? "-"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmtKRW(effective)}
                      </td>
                      <td className="px-4 py-3">
                        {p.locked && (
                          <span className="mr-1 text-xs text-neutral-500">🔒</span>
                        )}
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === "approved"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : p.status === "pending"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                          }`}
                        >
                          {p.status === "approved"
                            ? "승인"
                            : p.status === "pending"
                              ? "대기"
                              : "거절"}
                        </span>
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
