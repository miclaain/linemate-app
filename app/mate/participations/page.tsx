import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtKRW } from "@/lib/admin/format";

export default async function MyParticipationsPage({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const { submitted } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const linemateId = user!.id;

  const { data } = await supabase
    .from("participations")
    .select(
      "id, date, role, unit_price, status, reject_reason, locked, notes, projects(name, default_unit_price)",
    )
    .eq("linemate_id", linemateId)
    .order("date", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    date: string;
    role: string | null;
    unit_price: number | null;
    status: "pending" | "approved" | "rejected";
    reject_reason: string | null;
    locked: boolean;
    notes: string | null;
    projects: { name: string; default_unit_price: number } | null;
  }>;

  const total = rows
    .filter((r) => r.status === "approved")
    .reduce(
      (sum, r) =>
        sum + Number(r.unit_price ?? r.projects?.default_unit_price ?? 0),
      0,
    );

  return (
    <div className="space-y-5">
      <Link
        href="/mate"
        className="group inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-800"
      >
        <span className="inline-block transition-transform group-hover:-translate-x-1">
          ←
        </span>
        <span>홈으로</span>
      </Link>

      <header>
        <h1 className="text-lg font-bold text-gray-900 dark:text-neutral-100">
          내 제출 내역
        </h1>
        <p className="mt-0.5 text-sm text-gray-400">
          전체 {rows.length}건 · 승인 합계 {fmtKRW(total)}
        </p>
      </header>

      {submitted === "1" && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          ✅ 정산이 제출되었습니다. 관리자 승인 후 정산에 반영됩니다.
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-3xl border-2 border-dashed border-gray-200 px-6 py-16 text-center dark:border-neutral-800">
          <div className="mb-3 text-4xl">🗂️</div>
          <p className="text-sm font-medium text-gray-400">
            아직 제출한 내역이 없습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const effective =
              r.unit_price ?? r.projects?.default_unit_price ?? 0;
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-neutral-100">
                      {r.projects?.name ?? "(삭제된 프로젝트)"}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-400">
                      {fmtDate(r.date)} · {r.role ?? "-"}
                      {r.locked && (
                        <span className="ml-1 text-gray-500">🔒</span>
                      )}
                    </p>
                  </div>
                  <StatusPill status={r.status} />
                </div>
                <div className="flex items-baseline justify-between border-t border-gray-100 pt-2 dark:border-neutral-800">
                  <span className="text-xs text-gray-400">청구 금액</span>
                  <span className="text-base font-black text-teal-700 dark:text-teal-400">
                    {fmtKRW(effective)}
                  </span>
                </div>
                {r.notes && (
                  <p className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-xs text-gray-600 dark:bg-neutral-800 dark:text-neutral-400">
                    💬 {r.notes}
                  </p>
                )}
                {r.status === "rejected" && r.reject_reason && (
                  <p className="mt-2 rounded-lg bg-red-50 px-2.5 py-1.5 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
                    반려 사유: {r.reject_reason}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "pending" | "approved" | "rejected";
}) {
  const cfg = {
    pending: {
      label: "검토중",
      cls: "bg-amber-100 text-amber-700",
    },
    approved: {
      label: "승인",
      cls: "bg-emerald-100 text-emerald-700",
    },
    rejected: {
      label: "반려",
      cls: "bg-red-100 text-red-700",
    },
  }[status];
  return (
    <span
      className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-black ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}
