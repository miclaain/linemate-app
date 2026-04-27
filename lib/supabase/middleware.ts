import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Middleware Supabase client. Refreshes auth session cookies on every request,
 * then enforces auth + linemate.status='active' gate.
 *
 * Routing rules:
 *  - public paths (/auth/*, /signup/pending, /api/health): always allowed
 *  - unauthenticated → /auth/login
 *  - authenticated but linemate.status='pending' or no row → /signup/pending
 *  - everything else: pass through
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Critical: getUser() validates the JWT against Supabase Auth.
  // getSession() does NOT — never trust it for auth gating.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname.startsWith("/auth") ||
    pathname.startsWith("/signup/pending") ||
    pathname.startsWith("/api/health") ||
    pathname === "/favicon.ico";

  if (isPublicPath) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated — check linemate row + status. RLS lets a user read their own row.
  const { data: linemate } = await supabase
    .from("linemates")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  const role = (user.app_metadata as { role?: string } | null)?.role;
  const isAdmin = role === "admin";

  if (!isAdmin && (!linemate || linemate.status !== "active")) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup/pending";
    return NextResponse.redirect(url);
  }

  return response;
}
