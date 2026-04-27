import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { currentYearMonth, fmtKRW } from "@/lib/admin/format";

/**
 * Admin dashboard. Shows action-needed counts up top so the admin sees
 * unblocked work first (pending linemates, pending participations).
 */
export default async function AdminDashboard() {
  const { supabase } = await requireAdmin();
  const ym = currentYearMonth();
  const monthStart = `${ym}-01`;
  // Last day of month: roll forward 1 month then back 1 day.
  const [yearStr, monthStr] = ym.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);
  const nextMonth = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(nextMonth.getTime() - 86400000);
  const monthEnd = lastDay.toISOString().slice(0, 10);

  const [
    pendingLinematesRes,
    activeLinematesRes,
    pendingPartsRes,
    pendingLoginReqRes,
    monthDraftRes,
    monthFinalizedRes,
  ] = await Promise.all([
    supabase
      .from("linemates")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("linemates")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("participations")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("login_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("participations")
      .select("unit_price, projects(default_unit_price)")
      .eq("status", "approved")
      .gte("date", monthStart)
      .lte("date", monthEnd),
    supabase
      .from("settlements")
      .select("total_amount")
      .eq("year_month", ym),
  ]);

  const pendingLinemates = pendingLinematesRes.count ?? 0;
  const activeLinemates = activeLinematesRes.count ?? 0;
  const pendingParts = pendingPartsRes.count ?? 0;
  const pendingLoginRequests = pendingLoginReqRes.count ?? 0;

  const monthDraftRows = (monthDraftRes.data ?? []) as unknown as Array<{
    unit_price: number | null;
    projects: { default_unit_price: number } | null;
  }>;
  const monthDraftTotal = monthDraftRows.reduce((sum, row) => {
    const price = row.unit_price ?? row.projects?.default_unit_price ?? 0;
    return sum + Number(price);
  }, 0);

  const monthFinalizedRows = (monthFinalizedRes.data ?? []) as Array<{
    total_amount: number;
  }>;
  const isFinalized = monthFinalizedRows.length > 0;
  const monthFinalizedTotal = monthFinalizedRows.reduce(
    (sum, row) => sum + Number(row.total_amount),
    0,
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">대시보드</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          처리 대기 중인 항목과 이번 달({ym}) 정산 현황입니다.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <ActionCard
          href="/admin/login-requests"
          label="로그인 시도 (실패)"
          value={pendingLoginRequests}
          highlight={pendingLoginRequests > 0}
          suffix="건"
        />
        <ActionCard
          href="/admin/linemates?status=pending"
          label="가입 신청"
          value={pendingLinemates}
          highlight={pendingLinemates > 0}
          suffix="건"
        />
        <ActionCard
          href="/admin/participations?status=pending"
          label="참여 승인 대기"
          value={pendingParts}
          highlight={pendingParts > 0}
          suffix="건"
        />
        <ActionCard
          href="/admin/linemates?status=active"
          label="활성 라인메이트"
          value={activeLinemates}
          suffix="명"
        />
        <ActionCard
          href={`/admin/settlements`}
          label={isFinalized ? `${ym} 마감 완료` : `${ym} 정산 합계 (집계 중)`}
          valueDisplay={fmtKRW(
            isFinalized ? monthFinalizedTotal : monthDraftTotal,
          )}
        />
      </section>

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
          빠른 이동
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <QuickLink href="/admin/projects/new">+ 새 프로젝트</QuickLink>
          <QuickLink href="/admin/projects">프로젝트 목록</QuickLink>
          <QuickLink href="/admin/participations">전체 참여 내역</QuickLink>
          <QuickLink href="/admin/settlements">정산 관리</QuickLink>
        </div>
      </section>
    </div>
  );
}

function ActionCard({
  href,
  label,
  value,
  valueDisplay,
  suffix,
  highlight,
}: {
  href: string;
  label: string;
  value?: number;
  valueDisplay?: string;
  suffix?: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-lg border p-4 transition-colors ${
        highlight
          ? "border-amber-300 bg-amber-50 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
          : "border-neutral-200 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-900"
      }`}
    >
      <p className="text-xs text-neutral-600 dark:text-neutral-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">
        {valueDisplay ?? value}
        {suffix && (
          <span className="ml-1 text-sm font-normal text-neutral-500">
            {suffix}
          </span>
        )}
      </p>
    </Link>
  );
}

function QuickLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
    >
      {children}
    </Link>
  );
}
