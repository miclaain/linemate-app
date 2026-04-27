import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Mate-facing layout. Mobile-first, sticky header. Admin users get redirected
 * to the admin console — this surface is only for active linemates.
 */
export default async function MateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const role = (user.app_metadata as { role?: string } | null)?.role;
  if (role === "admin") redirect("/admin");

  const { data: linemate } = await supabase
    .from("linemates")
    .select("id, name, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!linemate || linemate.status !== "active") {
    redirect("/signup/pending");
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-neutral-950">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/mate" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-md">
              <span className="text-xs font-black tracking-tight text-white">
                LM
              </span>
            </div>
            <div className="leading-tight">
              <p className="text-sm font-black text-gray-900 dark:text-neutral-100">
                라인메이트
              </p>
              <p className="text-xs font-medium text-gray-400">
                {linemate.name}
              </p>
            </div>
          </Link>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-neutral-700 dark:text-neutral-400"
            >
              로그아웃
            </button>
          </form>
        </div>
        <div className="h-1 bg-gradient-to-r from-teal-400 to-emerald-500" />
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>

      <footer className="pb-8 pt-4 text-center text-xs font-medium text-gray-300">
        라인메이트 · 2026
      </footer>
    </div>
  );
}
