import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supabase redirects here with a `code` query param.
 * We exchange it for a session, then ensure a `linemates` row exists
 * (status='pending' on first login) and route by status.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(
      `${origin}/auth/login?error=${encodeURIComponent(exchangeError.message)}`,
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/auth/login?error=no_user`);
  }

  // Ensure linemates row exists. RLS policy `linemates_insert_self` allows
  // INSERT where id=auth.uid() AND status='pending'.
  const { data: existing } = await supabase
    .from("linemates")
    .select("status")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    const { error: insertError } = await supabase.from("linemates").insert({
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name ?? user.email!.split("@")[0],
      status: "pending",
    });

    if (insertError) {
      return NextResponse.redirect(
        `${origin}/auth/login?error=${encodeURIComponent(insertError.message)}`,
      );
    }

    return NextResponse.redirect(`${origin}/signup/pending`);
  }

  if (existing.status !== "active") {
    const role = (user.app_metadata as { role?: string } | null)?.role;
    if (role !== "admin") {
      return NextResponse.redirect(`${origin}/signup/pending`);
    }
  }

  return NextResponse.redirect(`${origin}${next}`);
}
