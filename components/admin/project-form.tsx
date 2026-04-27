/**
 * Shared project form. Used by /admin/projects/new and /admin/projects/[id].
 * Server-rendered — accepts a server action via the `action` prop.
 */
type Project = {
  id?: string;
  name?: string;
  client?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  default_unit_price?: number | null;
  sub_rate?: number | null;
  notes?: string | null;
};

export function ProjectForm({
  action,
  project,
  submitLabel = "저장",
}: {
  action: (formData: FormData) => Promise<void>;
  project?: Project;
  submitLabel?: string;
}) {
  return (
    <form action={action} className="space-y-4">
      {project?.id && <input type="hidden" name="id" value={project.id} />}

      <Field label="프로젝트명" required>
        <input
          name="name"
          required
          defaultValue={project?.name ?? ""}
          placeholder="예: 2026 상반기 리더십 워크숍"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
      </Field>

      <Field label="발주처">
        <input
          name="client"
          defaultValue={project?.client ?? ""}
          placeholder="예: ○○기업 인재개발팀"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="시작일">
          <input
            type="date"
            name="period_start"
            defaultValue={project?.period_start ?? ""}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            name="period_end"
            defaultValue={project?.period_end ?? ""}
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="메인 단가 (원)"
          required
          hint="참여 등록 시 메인 역할의 기본값"
        >
          <input
            type="number"
            name="default_unit_price"
            required
            min="0"
            step="1"
            defaultValue={project?.default_unit_price ?? ""}
            placeholder="500000"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
          />
        </Field>
        <Field
          label="보조 단가 (원)"
          hint="비워두면 보조 옵션 비활성화"
        >
          <input
            type="number"
            name="sub_rate"
            min="0"
            step="1"
            defaultValue={project?.sub_rate ?? ""}
            placeholder="250000"
            className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm tabular-nums"
          />
        </Field>
      </div>

      <Field label="메모">
        <textarea
          name="notes"
          defaultValue={project?.notes ?? ""}
          rows={3}
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-transparent px-3 py-2 text-sm"
        />
      </Field>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 px-4 py-2 text-sm font-medium"
        >
          {submitLabel}
        </button>
      </div>
    </form>
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
