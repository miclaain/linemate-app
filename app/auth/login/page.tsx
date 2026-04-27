import { Suspense } from "react";
import { LoginForm } from "./login-form";

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
            이메일로 로그인 링크를 받습니다.
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
