import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/**
 * Admin route guard. Use at the top of every Server Component / Server Action
 * under /admin/*. RLS already blocks non-admin writes, but the explicit check
 * gives clean redirects + clearer error messages.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login?next=/admin");
  }

  const role = (user.app_metadata as { role?: string } | null)?.role;
  if (role !== "admin") {
    redirect("/");
  }

  return { user: user as User, supabase };
}
