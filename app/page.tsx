import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-aware home. Middleware already gates non-public paths, so by the time
 * we reach here the user is authenticated AND has linemates.status='active'
 * (or app_metadata.role='admin').
 *
 * - Admin → redirect to /admin console
 * - 라인메이트 → minimal landing (Week 2 will replace this with the mobile flow)
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | null)?.role;
  const isAdmin = role === "admin";

  if (isAdmin) {
    redirect("/admin");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-4 text-center">
        <h1 className="text-2xl font-semibold">라인메이트</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {user?.email}
        </p>
        <p className="text-xs text-neutral-500">
          Week 2부터 참여 등록 폼·이력·내 정산 화면이 들어갑니다.
        </p>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="rounded-md border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm"
          >
            로그아웃
          </button>
        </form>
      </div>
    </main>
  );
}
