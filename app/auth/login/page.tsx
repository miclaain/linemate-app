import { Suspense } from "react";
import { LoginForm } from "./login-form";

// Force dynamic rendering. /auth/login uses useSearchParams (client), and
// Vercel's CLI builder didn't accept the static-with-suspense output.
export const dynamic = "force-dynamic";

/**
 * Magic-link login. Server component wraps the client form in Suspense
 * so useSearchParams() doesn't bail prerendering.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm space-y-6">
        <header className="space-y-1">
          <h1 className="text-2xl font-semibold">라인메이트 로그인</h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            이름과 PIN을 입력하세요. PIN을 모르면 관리자에게 요청을 보내실 수
            있습니다.
          </p>
        </header>

        <Suspense
          fallback={
            <div className="h-32 animate-pulse rounded-md bg-neutral-100 dark:bg-neutral-900" />
          }
        >
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
