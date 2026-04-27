import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate } from "@/lib/admin/format";
import {
  StatusBadge,
  linemateStatusLabel,
  linemateStatusVariant,
} from "@/components/admin/status-badge";

type StatusFilter = "all" | "pending" | "active" | "inactive";

const STATUS_TABS: Array<{ value: StatusFilter; label: string }> = [
  { value: "pending", label: "신청대기" },
  { value: "active", label: "활성" },
  { value: "inactive", label: "비활성" },
  { value: "all", label: "전체" },
];

export default async function LinematesListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const { status: rawStatus } = await searchParams;
  const status: StatusFilter =
    rawStatus === "active" ||
    rawStatus === "inactive" ||
    rawStatus === "all" ||
    rawStatus === "pending"
      ? rawStatus
      : "pending";

  let query = supabase
    .from("linemates")
    .select("id, name, email, phone, role_default, status, created_at, approved_at")
    .order("created_at", { ascending: false });

  if (status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  const rows = (data ?? []) as Array<{
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role_default: string | null;
    status: string;
    created_at: string;
    approved_at: string | null;
  }>;

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">라인메이트</h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            가입 신청·승인·비활성화 관리.
          </p>
        </div>
      </header>

      <nav className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
        {STATUS_TABS.map((tab) => {
          const active = tab.value === status;
          return (
            <Link
              key={tab.value}
              href={
                tab.value === "pending"
                  ? "/admin/linemates"
                  : `/admin/linemates?status=${tab.value}`
              }
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

      {error ? (
        <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          조회 실패: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-8 text-center text-sm text-neutral-500">
          해당 상태의 라인메이트가 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-medium">이름</th>
                <th className="px-4 py-3 font-medium">이메일</th>
                <th className="px-4 py-3 font-medium">연락처</th>
                <th className="px-4 py-3 font-medium">기본 역할</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">신청일</th>
                <th className="px-4 py-3 font-medium">승인일</th>
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
                      href={`/admin/linemates/${row.id}`}
                      className="hover:underline"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {row.email}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {row.phone ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {row.role_default ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge variant={linemateStatusVariant(row.status)}>
                      {linemateStatusLabel(row.status)}
                    </StatusBadge>
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {fmtDate(row.created_at)}
                  </td>
                  <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                    {fmtDate(row.approved_at)}
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
