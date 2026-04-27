import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser-side Supabase client (Client Components).
 * Uses anon key only — RLS enforces all access control.
 *
 * NEVER import service_role here. service_role lives in Edge Functions only.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
