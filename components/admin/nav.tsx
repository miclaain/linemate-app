"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "대시보드", match: (p: string) => p === "/admin" },
  {
    href: "/admin/linemates",
    label: "라인메이트",
    match: (p: string) => p.startsWith("/admin/linemates"),
  },
  {
    href: "/admin/projects",
    label: "프로젝트",
    match: (p: string) => p.startsWith("/admin/projects"),
  },
  {
    href: "/admin/participations",
    label: "참여 내역",
    match: (p: string) => p.startsWith("/admin/participations"),
  },
  {
    href: "/admin/settlements",
    label: "정산",
    match: (p: string) => p.startsWith("/admin/settlements"),
  },
];

export function AdminNav({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 px-3 py-6">
      <div className="mb-6 px-2">
        <Link href="/admin" className="block">
          <h2 className="text-sm font-semibold tracking-tight">
            라인메이트 관리자
          </h2>
        </Link>
        <p className="mt-1 truncate text-xs text-neutral-500" title={userEmail}>
          {userEmail}
        </p>
      </div>

      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-md px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "text-neutral-700 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-800"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <form action="/auth/signout" method="post" className="mt-auto pt-6">
        <button
          type="submit"
          className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-900"
        >
          로그아웃
        </button>
      </form>
    </aside>
  );
}
