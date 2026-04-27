import { createClient as createSbClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for privileged operations (auth.admin.*).
 *
 * MUST only be invoked from code paths already protected by `requireAdmin()`.
 * Never import this file from a client component. SUPABASE_SERVICE_ROLE_KEY is
 * not NEXT_PUBLIC_, so client bundles would fail anyway, but keep imports
 * confined to "use server" files for clarity.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase URL or SUPABASE_SERVICE_ROLE_KEY missing");
  }
  return createSbClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Generate a 6-digit numeric PIN. Uses crypto.getRandomValues for unbiased
 * distribution; not cryptographic strength but sufficient for a short-lived
 * password that admins reset on demand.
 */
export function generatePin(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(buf[0] % 1_000_000).padStart(6, "0");
}
