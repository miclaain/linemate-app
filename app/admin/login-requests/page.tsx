import Link from "next/link";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDateTime } from "@/lib/admin/format";
import { StatusBadge } from "@/components/admin/status-badge";
import { cancelLoginRequest, issuePinForRequest } from "./actions";

export default async function LoginRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    pin?: string;
    linemate?: string;
    error?: string;
  }>;
}) {
  const { pin, linemate, error } = await searchParams;
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

  const pending = rows.filter((r) => r.status === "pending");
  const handled = rows.filter((r) => r.status !== "pending");

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">로그인 요청</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          메이트가 이름으로 PIN을 요청한 내역입니다. 카톡으로 PIN을 직접
          전달해주세요.
        </p>
      </header>

      {pin && (
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            PIN이 발급되었습니다. 메이트에게 카톡으로 전달해주세요.
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-emerald-900 dark:text-emerald-100">
            {pin}
          </p>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
            이 화면을 벗어나면 다시 볼 수 없습니다 (재발급은 가능).{" "}
            {linemate && (
              <Link
                href={`/admin/linemates/${linemate}`}
                className="underline"
              >
                메이트 상세 보기
              </Link>
            )}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          {error === "already_handled"
            ? "이미 처리된 요청입니다."
            : error === "unresolved"
              ? "이름이 모호하거나 매칭되는 활성 메이트가 없습니다. 메이트와 직접 확인 후 라인메이트 상세에서 PIN을 재발급해주세요."
              : `오류: ${error}`}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">
          대기 중 ({pending.length}건)
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            대기 중인 요청이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">요청 시각</th>
                  <th className="px-4 py-3 font-medium">입력한 이름</th>
                  <th className="px-4 py-3 font-medium">매칭된 메이트</th>
                  <th className="px-4 py-3 font-medium">처리</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {pending.map((r) => (
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
                          {r.linemates.name}{" "}
                          <span className="text-neutral-500">
                            ({r.linemates.email})
                          </span>
                        </Link>
                      ) : (
                        <span className="text-amber-700 dark:text-amber-400">
                          매칭 안됨 — 직접 확인 필요
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {r.linemate_id && (
                          <form action={issuePinForRequest}>
                            <input
                              type="hidden"
                              name="request_id"
                              value={r.id}
                            />
                            <button
                              type="submit"
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700"
                            >
                              PIN 발급
                            </button>
                          </form>
                        )}
                        <form action={cancelLoginRequest}>
                          <input
                            type="hidden"
                            name="request_id"
                            value={r.id}
                          />
                          <button
                            type="submit"
                            className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
                          >
                            취소
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">처리 완료 (최근 100건 중)</h2>
        {handled.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            처리된 요청이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">요청</th>
                  <th className="px-4 py-3 font-medium">입력한 이름</th>
                  <th className="px-4 py-3 font-medium">매칭된 메이트</th>
                  <th className="px-4 py-3 font-medium">처리</th>
                  <th className="px-4 py-3 font-medium">결과</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
                {handled.map((r) => (
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
                        {r.status === "pin_sent" ? "PIN 발급" : "취소"}
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
