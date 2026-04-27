import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate, fmtDateTime, fmtKRW } from "@/lib/admin/format";
import {
  StatusBadge,
  linemateStatusLabel,
  linemateStatusVariant,
} from "@/components/admin/status-badge";
import {
  approveLinemate,
  deactivateLinemate,
  resetLinematePin,
  updateLinemateProfile,
} from "./actions";

export default async function LinemateDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    saved?: string;
    pin?: string;
    pin_error?: string;
  }>;
}) {
  const { id } = await params;
  const { saved, pin, pin_error: pinError } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data: linemate } = await supabase
    .from("linemates")
    .select("id, name, email, phone, role_default, status, created_at, approved_at, approved_by")
    .eq("id", id)
    .maybeSingle();

  if (!linemate) notFound();

  // Recent participations for this linemate (last 20).
  const { data: parts } = await supabase
    .from("participations")
    .select(
      "id, date, role, hours, unit_price, status, locked, projects(name, default_unit_price)",
    )
    .eq("linemate_id", id)
    .order("date", { ascending: false })
    .limit(20);

  const partRows = (parts ?? []) as unknown as Array<{
    id: string;
    date: string;
    role: string | null;
    hours: number | null;
    unit_price: number | null;
    status: string;
    locked: boolean;
    projects: { name: string; default_unit_price: number } | null;
  }>;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/linemates"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 라인메이트 목록
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {linemate.name}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            {linemate.email}
          </p>
          <div className="mt-2">
            <StatusBadge variant={linemateStatusVariant(linemate.status)}>
              {linemateStatusLabel(linemate.status)}
            </StatusBadge>
          </div>
        </div>

        <div className="flex gap-2">
          {linemate.status !== "active" && (
            <form action={approveLinemate}>
              <input type="hidden" name="id" value={linemate.id} />
              <button
                type="submit"
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
              >
                승인 (활성화)
              </button>
            </form>
          )}
          {linemate.status === "active" && (
            <form action={resetLinematePin}>
              <input type="hidden" name="id" value={linemate.id} />
              <button
                type="submit"
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
              >
                PIN 재발급
              </button>
            </form>
          )}
          {linemate.status !== "inactive" && (
            <form action={deactivateLinemate}>
              <input type="hidden" name="id" value={linemate.id} />
              <button
                type="submit"
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                {linemate.status === "pending" ? "거절" : "비활성화"}
              </button>
            </form>
          )}
        </div>
      </header>

      {pin && (
        <div className="rounded-lg border-2 border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            로그인 PIN이 발급되었습니다. 메이트에게 전달해주세요.
          </p>
          <p className="mt-2 font-mono text-3xl font-bold tracking-widest text-emerald-900 dark:text-emerald-100">
            {pin}
          </p>
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300">
            이메일: <span className="font-mono">{linemate.email}</span> · 이 화면을 벗어나면 다시 볼 수 없습니다 (재발급은 가능).
          </p>
        </div>
      )}

      {pinError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          PIN 발급 실패: {pinError}
        </p>
      )}

      {saved === "1" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          저장되었습니다.
        </p>
      )}

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <h2 className="mb-4 text-sm font-medium">프로필 수정</h2>
        <form action={updateLinemateProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <input type="hidden" name="id" value={linemate.id} />
          <Field label="이름">
            <input
              name="name"
              defaultValue={linemate.name}
              required
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          <Field label="연락처">
            <input
              name="phone"
              defaultValue={linemate.phone ?? ""}
              placeholder="010-0000-0000"
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          <Field label="기본 역할" hint="참여 등록 폼의 기본값">
            <input
              name="role_default"
              defaultValue={linemate.role_default ?? ""}
              placeholder="예: 메인 퍼실리테이터"
              className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
            />
          </Field>
          <Field label="이메일 (수정 불가)">
            <input
              value={linemate.email}
              disabled
              className="w-full rounded-md border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-3 py-2 text-sm text-neutral-500"
            />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
            >
              저장
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-medium">메타 정보</h2>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 text-sm">
          <Meta label="신청일" value={fmtDateTime(linemate.created_at)} />
          <Meta label="승인일" value={fmtDateTime(linemate.approved_at)} />
        </dl>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">최근 참여 내역 (최대 20건)</h2>
        {partRows.length === 0 ? (
          <p className="rounded-md border border-dashed border-neutral-300 dark:border-neutral-700 p-6 text-center text-sm text-neutral-500">
            참여 내역이 없습니다.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 dark:bg-neutral-900 text-left text-xs uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-3 font-medium">날짜</th>
                  <th className="px-4 py-3 font-medium">프로젝트</th>
                  <th className="px-4 py-3 font-medium">역할</th>
                  <th className="px-4 py-3 font-medium text-right">시간</th>
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
                      className="hover:bg-neutral-50 dark:hover:bg-neutral-900"
                    >
                      <td className="px-4 py-3">{fmtDate(p.date)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/participations/${p.id}`}
                          className="hover:underline"
                        >
                          {p.projects?.name ?? "(unknown)"}
                        </Link>
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
                          <span className="mr-1 text-xs text-neutral-500">
                            🔒
                          </span>
                        )}
                        <StatusBadge
                          variant={
                            p.status === "approved"
                              ? "success"
                              : p.status === "pending"
                                ? "warning"
                                : "danger"
                          }
                        >
                          {p.status === "approved"
                            ? "승인"
                            : p.status === "pending"
                              ? "대기"
                              : "거절"}
                        </StatusBadge>
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

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
        {hint && (
          <span className="ml-1 font-normal text-neutral-500">({hint})</span>
        )}
      </span>
      {children}
    </label>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-neutral-500">{label}</dt>
      <dd>{value}</dd>
    </>
  );
}
