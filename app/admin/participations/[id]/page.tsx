import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guard";
import { fmtDate, fmtDateTime, fmtKRW } from "@/lib/admin/format";
import {
  StatusBadge,
  participationStatusLabel,
  participationStatusVariant,
} from "@/components/admin/status-badge";
import {
  approveParticipation,
  rejectParticipation,
  updateParticipation,
} from "./actions";

export default async function ParticipationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { id } = await params;
  const { saved } = await searchParams;
  const { supabase } = await requireAdmin();

  const { data } = await supabase
    .from("participations")
    .select(
      "id, date, role, hours, unit_price, status, locked, reject_reason, submitted_at, approved_at, linemates(id, name, email), projects(id, name, default_unit_price)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!data) notFound();

  const part = data as unknown as {
    id: string;
    date: string;
    role: string | null;
    hours: number | null;
    unit_price: number | null;
    status: string;
    locked: boolean;
    reject_reason: string | null;
    submitted_at: string;
    approved_at: string | null;
    linemates: { id: string; name: string; email: string } | null;
    projects: { id: string; name: string; default_unit_price: number } | null;
  };

  const effectivePrice =
    part.unit_price ?? part.projects?.default_unit_price ?? null;

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/participations"
          className="text-sm text-neutral-500 hover:underline"
        >
          ← 참여 내역 목록
        </Link>
      </div>

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {fmtDate(part.date)} ·{" "}
            {part.projects ? (
              <Link
                href={`/admin/projects/${part.projects.id}`}
                className="hover:underline"
              >
                {part.projects.name}
              </Link>
            ) : (
              "(deleted project)"
            )}
          </h1>
          <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
            라인메이트:{" "}
            {part.linemates ? (
              <Link
                href={`/admin/linemates/${part.linemates.id}`}
                className="hover:underline"
              >
                {part.linemates.name}
              </Link>
            ) : (
              "(deleted)"
            )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {part.locked && (
              <span className="text-xs text-neutral-500">🔒 마감 잠금</span>
            )}
            <StatusBadge variant={participationStatusVariant(part.status)}>
              {participationStatusLabel(part.status)}
            </StatusBadge>
          </div>
        </div>

        {!part.locked && part.status !== "approved" && (
          <form action={approveParticipation}>
            <input type="hidden" name="id" value={part.id} />
            <button
              type="submit"
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
            >
              승인
            </button>
          </form>
        )}
      </header>

      {saved === "1" && (
        <p className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-300">
          저장되었습니다.
        </p>
      )}

      {part.locked && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
          이 참여 내역은 월 마감으로 잠겨 있어 수정·삭제할 수 없습니다.
        </p>
      )}

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
          <h2 className="mb-4 text-sm font-medium">상세 수정</h2>
          <fieldset disabled={part.locked} className="space-y-4 disabled:opacity-50">
            <form action={updateParticipation} className="space-y-4">
              <input type="hidden" name="id" value={part.id} />

              <Field label="날짜" required>
                <input
                  type="date"
                  name="date"
                  required
                  defaultValue={part.date}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
              </Field>

              <Field label="역할">
                <input
                  name="role"
                  defaultValue={part.role ?? ""}
                  placeholder="예: 메인 퍼실리테이터"
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="시간">
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    name="hours"
                    defaultValue={part.hours ?? ""}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
                  />
                </Field>
                <Field
                  label="단가 (원)"
                  hint={
                    part.unit_price == null
                      ? `미지정 → 기본 ${fmtKRW(part.projects?.default_unit_price)} 적용`
                      : ""
                  }
                >
                  <input
                    type="number"
                    step="1"
                    min="0"
                    name="unit_price"
                    defaultValue={part.unit_price ?? ""}
                    placeholder={
                      part.projects?.default_unit_price?.toString() ?? ""
                    }
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
                  />
                </Field>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
                >
                  수정 저장
                </button>
              </div>
            </form>
          </fieldset>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="mb-3 text-sm font-medium">정산 단가</h2>
            <p className="text-2xl font-semibold tabular-nums">
              {fmtKRW(effectivePrice)}
            </p>
            <p className="mt-1 text-xs text-neutral-500">
              {part.unit_price != null
                ? "이 참여에만 적용되는 보정 단가"
                : "프로젝트 기본 단가 적용 중"}
            </p>
          </div>

          {!part.locked && part.status !== "rejected" && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 p-6">
              <h2 className="mb-3 text-sm font-medium text-red-700 dark:text-red-300">
                거절
              </h2>
              <form action={rejectParticipation} className="space-y-3">
                <input type="hidden" name="id" value={part.id} />
                <textarea
                  name="reject_reason"
                  required
                  rows={3}
                  placeholder="거절 사유를 입력하세요. 라인메이트에게 그대로 전달됩니다."
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="rounded-md border border-red-300 dark:border-red-800 px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    거절 처리
                  </button>
                </div>
              </form>
            </div>
          )}

          {part.status === "rejected" && part.reject_reason && (
            <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-6">
              <h2 className="mb-2 text-sm font-medium text-red-700 dark:text-red-300">
                거절 사유
              </h2>
              <p className="text-sm whitespace-pre-wrap">{part.reject_reason}</p>
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 p-6">
            <h2 className="mb-3 text-sm font-medium">메타 정보</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <dt className="text-neutral-500">제출 시간</dt>
              <dd>{fmtDateTime(part.submitted_at)}</dd>
              <dt className="text-neutral-500">승인 시간</dt>
              <dd>{fmtDateTime(part.approved_at)}</dd>
            </dl>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
        {label}
        {required && <span className="ml-0.5 text-red-600">*</span>}
        {hint && (
          <span className="ml-1 font-normal text-neutral-500">({hint})</span>
        )}
      </span>
      {children}
    </label>
  );
}
