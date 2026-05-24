import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase-admin";
import { createCheckoutLink } from "@/lib/square";

/**
 * POST /api/billing/checkout
 * Square Payment Link を作成して URL を返す。
 * フロントエンドはこの URL にリダイレクトしてユーザーを Square の決済ページへ誘導する。
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = await createCheckoutLink(user.id);
    return NextResponse.json({ url });
  } catch (e) {
    console.error("checkout error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "チェックアウトの作成に失敗しました" },
      { status: 500 },
    );
  }
}
