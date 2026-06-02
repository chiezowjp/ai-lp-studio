import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/supabase-admin";
import { createSubscription } from "@/lib/paypal";

/**
 * POST /api/billing/checkout
 * PayPal サブスクリプションを作成して承認 URL を返す。
 * フロントエンドはこの URL にリダイレクトしてユーザーを PayPal の承認画面へ誘導する。
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { approvalUrl } = await createSubscription(user.id);
    return NextResponse.json({ url: approvalUrl });
  } catch (e) {
    console.error("checkout error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "チェックアウトの作成に失敗しました" },
      { status: 500 },
    );
  }
}
