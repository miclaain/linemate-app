/**
 * Shared display formatters for admin tables.
 * Keep ko-KR locale + 원/날짜 conventions in one place so the UI stays consistent.
 */

const krwFormatter = new Intl.NumberFormat("ko-KR");

export function fmtKRW(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(n)) return "-";
  return `${krwFormatter.format(n)}원`;
}

export function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function fmtDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Current month in 'YYYY-MM' format (Asia/Seoul). Used as default for
 * settlements / participations filters.
 */
export function currentYearMonth(): string {
  // Use Intl to get Asia/Seoul wall-clock without extra deps.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
  });
  return fmt.format(new Date()).replace(/[^\d-]/g, "").slice(0, 7);
}

/**
 * Generate the last N months in 'YYYY-MM' format, descending from current.
 */
export function recentYearMonths(count: number): string[] {
  const now = new Date();
  const result: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    result.push(ym);
  }
  return result;
}
