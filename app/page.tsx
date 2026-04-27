import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Auth-aware home. Routes admin → /admin console, mates → /mate workshop view.
 * Middleware already gates non-public paths.
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const role = (user?.app_metadata as { role?: string } | null)?.role;
  if (role === "admin") redirect("/admin");
  redirect("/mate");
}
