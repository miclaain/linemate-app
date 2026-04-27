import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/guard";

/**
 * CSV export for a finalized month. Excel-friendly UTF-8 BOM + CRLF.
 * Format: 라인메이트, 이메일, 합계
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ym: string }> },
) {
  const { ym } = await params;
  if (!/^\d{4}-\d{2}$/.test(ym)) {
    return new NextResponse("invalid month", { status: 400 });
  }

  const { supabase } = await requireAdmin();

  const { data, error } = await supabase
    .from("settlements")
    .select("total_amount, linemates(name, email)")
    .eq("year_month", ym)
    .order("total_amount", { ascending: false });

  if (error) {
    return new NextResponse(`조회 실패: ${error.message}`, { status: 500 });
  }

  type Row = {
    total_amount: number;
    linemates: { name: string; email: string } | null;
  };
  const rows = (data ?? []) as unknown as Row[];

  if (rows.length === 0) {
    return new NextResponse("해당 월은 마감되지 않았거나 대상이 없습니다.", {
      status: 404,
    });
  }

  // Excel-safe CSV: BOM + CRLF + double-quote escape.
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = ["라인메이트", "이메일", "합계"].map(escape).join(",");
  const body = rows
    .map((r) =>
      [
        escape(r.linemates?.name ?? ""),
        escape(r.linemates?.email ?? ""),
        escape(String(r.total_amount)),
      ].join(","),
    )
    .join("\r\n");
  const csv = "\uFEFF" + header + "\r\n" + body + "\r\n";

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="linemate-${ym}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
