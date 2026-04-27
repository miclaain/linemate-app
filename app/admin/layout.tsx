import type { Metadata } from "next";
import { requireAdmin } from "@/lib/admin/guard";
import { AdminNav } from "@/components/admin/nav";

export const metadata: Metadata = {
  title: "라인메이트 관리자",
};

// Admin pages all read user-bound cookies + RLS-scoped data.
export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = await requireAdmin();

  return (
    <div className="flex min-h-screen">
      <AdminNav userEmail={user.email ?? "(no email)"} />
      <main className="flex-1 px-8 py-8">{children}</main>
    </div>
  );
}
