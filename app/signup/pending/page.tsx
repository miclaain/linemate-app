import { createClient } from "@/lib/supabase/server";

export default async function SignupPendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="max-w-sm space-y-3 text-center">
        <h1 className="text-xl font-semibold">가입 승인 대기 중</h1>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          {user?.email
            ? `${user.email}로 가입 신청이 접수되었습니다.`
            : "가입 신청이 접수되었습니다."}
        </p>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          관리자 승인 후 로그인이 가능합니다.
        </p>
      </div>
    </main>
  );
}
