/**
 * Colored pill for status enums. Server-renderable.
 */
type Variant = "neutral" | "success" | "warning" | "danger" | "info";

const styles: Record<Variant, string> = {
  neutral:
    "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  success:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  warning:
    "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  danger: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
};

export function StatusBadge({
  variant = "neutral",
  children,
}: {
  variant?: Variant;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[variant]}`}
    >
      {children}
    </span>
  );
}

export function linemateStatusVariant(status: string): Variant {
  if (status === "active") return "success";
  if (status === "pending") return "warning";
  return "neutral";
}

export function linemateStatusLabel(status: string): string {
  if (status === "active") return "활성";
  if (status === "pending") return "신청대기";
  if (status === "inactive") return "비활성";
  return status;
}

export function participationStatusVariant(status: string): Variant {
  if (status === "approved") return "success";
  if (status === "pending") return "warning";
  if (status === "rejected") return "danger";
  return "neutral";
}

export function participationStatusLabel(status: string): string {
  if (status === "approved") return "승인";
  if (status === "pending") return "대기";
  if (status === "rejected") return "거절";
  return status;
}
