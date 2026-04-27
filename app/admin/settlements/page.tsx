import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import {
  fmtDate,
  fmtDateTime,
  fmtKRW,
  currentYearMonth,
  recentYearMonths,
} from "@/lib/admin/format";
import { finalizeMonth } from "./actions";

function ymRange(ym: string): { start: string; end: string } | null {
  if (!/^\d{4}-\d{2}$/.test(ym)) return null;
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const next = new Date(Date.UTC(y, m, 1));
  const last = new Date(next.getTime() - 86400000);
  const end = last.toISOString().slice(0, 10);
  return { start, end };
}

export default async function SettlementsOverviewPage() {
  const { supabase } = await requireAdmin();
  const currentYM = currentYearMonth();
  const range = ymRange(currentYM)!;

  // Settlements history (all finalized months).
  const { data: settlementsData } = await supabase
    .from("settlements")
    .select("year_month, total_amount, finalized_at, exported_at")
    .order("year_month", { ascending: false });

  type SettlementRow = {
    year_month: string;
    total_amount: number;
    finalized_at: string;
    exported_at: string | null;
  };
  const settlements = (settlementsData ?? []) as SettlementRow[];

  // Aggregate per month.
  const byMonth = new Map<
    string,
    { total: number; count: number; finalizedAt: string; exportedAt: string | null }
  >();
  for (const s of settlements) {
    const cur = byMonth.get(s.year_month);
    if (cur) {
      cur.total += Number(s.total_amount);
      cur.count += 1;
    } else {
      byMonth.set(s.year_month, {
        total: Number(s.total_amount),
        count: 1,
        finalizedAt: s.finalized_at,
        exportedAt: s.exported_at,
      });
    }
  }

  // Current month status.
  const isCurrentFinalized = byMonth.has(currentYM);

  // Current-month draft: per-linemate approved sums + pending count.
  const [draftPartsRes, pendingPartsCountRes] = await Promise.all([
    supabase
      .from("participations")
      .select(
        "id, status, unit_price, linemates(id, name), projects(default_unit_price)",
      )
      .gte("date", range.start)
      .lte("date", range.end),
    supabase
      .from("participations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gte("date", range.start)
      .lte("date", range.end),
  ]);

  type DraftRow = {
    id: string;
    status: string;
    unit_price: number | null;
    linemates: { id: string; name: string } | null;
    projects: { default_unit_price: number } | null;
  };
  const draftParts = (draftPartsRes.data ?? []) as unknown as DraftRow[];

  // Aggregate per linemate (approved only — finalize only counts approved).
  const draftByLinemate = new Map<string, { name: string; total: number; rows: number }>();
  for (const p of draftParts) {
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
    .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  const draftTotal = draftRows.reduce((s, r) => s + r.total, 0);
  const pendingCount = pendingPartsCountRes.count ?? 0;

  // History list: union of byMonth + last 6 months for empty placeholders.
  const recentList = recentYearMonths(6);
  const historyMonths = Array.from(
    new Set([...recentList, ...byMonth.keys()]),
  ).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">정산 관리</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          월 마감은 해당 월 승인된 참여 내역만 합산해 settlements 테이블에 저장하고,
          참여 내역을 잠급니다. 마감 후 수정·삭제·재마감 불가.
        </p>
      </header>

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-semibold">
            {currentYM} 진행 중
            {isCurrentFinalized && (
              <span className="ml-2 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                마감 완료
              </span>
            )}
          </h2>
          <Link
            href={`/admin/settlements/${currentYM}`}
            className="text-sm text-neutral-500 hover:underline"
          >
            상세 보기 →
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
            <p className="text-xs text-neutral-500">승인된 참여 합계</p>
            <p className="mt-1 text-xl font-semibold tabular-nums">
              {fmtKRW(draftTotal)}
            </p>
          </div>
          <div className="rounded-md border border-neutral-200 dark:border-neutral-800 p-3">
            <p className="text-xs text-neutral-500">대상 라인메이트</p>
            <p className="mt-1 text-xl font-semibold">
              {draftRows.length}
              <span className="ml-1 text-sm font-normal text-neutral-500">
                명
              </span>
            </p>
          </div>
          <div
            className={`rounded-md border p-3 ${
              pendingCount > 0
                ? "border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30"
                : "border-neutral-200 dark:border-neutral-800"
            }`}
          >
            <p className="text-xs text-neutral-500">미처리 참여 (대기)</p>
            <p className="mt-1 text-xl font-semibold">
              {pendingCount}
              <span className="ml-1 text-sm font-normal text-neutral-500">
                건
              </span>
            </p>
            {pendingCount > 0 && (
              <Link
                href={`/admin/participations?status=pending&month=${currentYM}`}
                className="mt-1 inline-block text-xs text-amber-800 underline dark:text-amber-300"
              >
                먼저 처리하기 →
              </Link>
            )}
          </div>
        </div>

        {!isCurrentFinalized && draftRows.length > 0 && (
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
                    <td className="px-4 py-2 text-right tabular-nums">
                      {fmtKRW(r.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isCurrentFinalized && (
          <form action={finalizeMonth} className="mt-6 flex items-end gap-3">
            <label className="block space-y-1">
              <span className="text-xs text-neutral-500">마감할 월</span>
              <input
                type="month"
                name="year_month"
                defaultValue={currentYM}
                required
                className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-1.5 text-sm"
              />
            </label>
            <button
              type="submit"
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
            >
              월 마감 실행
            </button>
            {pendingCount > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠ 대기 중인 참여 {pendingCount}건은 마감에 포함되지 않습니다.
              </p>
            )}
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold">월별 정산 기록</h2>
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">월</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium text-right">대상</th>
                <th className="px-4 py-3 font-medium text-right">합계</th>
                <th className="px-4 py-3 font-medium">마감일</th>
                <th className="px-4 py-3 font-medium">전송일</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
              {historyMonths.map((ym) => {
                const m = byMonth.get(ym);
                const finalized = !!m;
                return (
                  <tr
                    key={ym}
                    className="hover:bg-neutral-50 dark:hover:bg-neutral-900"
                  >
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/admin/settlements/${ym}`}
                        className="hover:underline"
                      >
                        {ym}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {finalized ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                          마감
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-neutral-100 px-2 py-0.5 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400">
                          미마감
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {finalized ? `${m!.count}명` : "-"}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {finalized ? fmtKRW(m!.total) : "-"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {finalized ? fmtDateTime(m!.finalizedAt) : "-"}
                    </td>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {finalized ? (m!.exportedAt ? fmtDate(m!.exportedAt) : "-") : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
