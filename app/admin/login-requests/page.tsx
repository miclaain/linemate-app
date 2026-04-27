import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDateTime } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { dismissLoginRequest } from "./actions";

/**
 * Audit log of failed mate login attempts (unmatched / ambiguous names).
 * Successful name-only logins do NOT write here — they go straight through
 * resolve_linemate_for_login + verifyOtp.
 */
export default async function LoginRequestsPage() {
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("login_requests")
    .select(
      "id, name_input, linemate_id, status, created_at, handled_at, linemates(name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as Array<{
    id: string;
    name_input: string;
    linemate_id: string | null;
    status: "pending" | "pin_sent" | "cancelled";
    created_at: string;
    handled_at: string | null;
    linemates: { name: string; email: string } | null;
  }>;

  const open = rows.filter((r) => r.status === "pending");
  const closed = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          로그인 시도 기록
        </h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          이름이 매칭되지 않았거나 동명이인이라 로그인에 실패한 메이트의 시도
          기록입니다. 필요하면 메이트와 직접 확인 후 라인메이트 정보(이름)를
          정정해주세요.
        </p>
      </header>

      <section>
        <h2 className="mb-3 text-sm font-medium">미확인 ({open.length}건)</h2>
        {open.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            미확인 시도가 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">시각</th>
                  <th className="px-4 py-3 font-medium">입력한 이름</th>
                  <th className="px-4 py-3 font-medium">상태</th>
                  <th className="px-4 py-3 font-medium">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {open.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                      {fmtDateTime(r.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium">{r.name_input}</td>
                    <td className="px-4 py-3">
                      {r.linemates ? (
                        <Link
                          href={`/admin/linemates/${r.linemate_id}`}
                          className="hover:underline"
                        >
                          매칭됨: {r.linemates.name}
                        </Link>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          매칭 실패 (이름 오타 또는 동명이인)
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <form action={dismissLoginRequest}>
                        <input
                          type="hidden"
                          name="request_id"
                          value={r.id}
                        />
                        <button
                          type="submit"
                          className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                        >
                          확인 처리
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">처리됨 (최근 100건 중)</h2>
        {closed.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            처리된 기록이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">시각</th>
                  <th className="px-4 py-3 font-medium">입력한 이름</th>
                  <th className="px-4 py-3 font-medium">매칭</th>
                  <th className="px-4 py-3 font-medium">처리 시각</th>
                  <th className="px-4 py-3 font-medium">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {closed.map((r) => (
                  <tr
                    key={r.id}
                    className="text-neutral-600 dark:text-neutral-400"
                  >
                    <td className="px-4 py-3">{fmtDateTime(r.created_at)}</td>
                    <td className="px-4 py-3">{r.name_input}</td>
                    <td className="px-4 py-3">
                      {r.linemates ? (
                        <Link
                          href={`/admin/linemates/${r.linemate_id}`}
                          className="hover:underline"
                        >
                          {r.linemates.name}
                        </Link>
                      ) : (
                        <span className="text-neutral-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.handled_at ? fmtDateTime(r.handled_at) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        variant={
                          r.status === "pin_sent" ? "success" : "neutral"
                        }
                      >
                        {r.status === "pin_sent"
                          ? "PIN 발급 (구버전)"
                          : "확인 완료"}
                      </StatusBadge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
