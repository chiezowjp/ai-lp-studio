import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Google OAuth コールバック。
 * Supabase が ?code=... を付けてリダイレクトしてくる。
 * セッション交換後にホームへリダイレクト。
 */
export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);
  const code  = searchParams.get("code");
  const next  = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Railway では origin が localhost になるため NEXT_PUBLIC_APP_URL を優先する
  const base = process.env.NEXT_PUBLIC_APP_URL ?? origin;
  return NextResponse.redirect(`${base}${next}`);
}
