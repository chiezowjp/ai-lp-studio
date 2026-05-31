import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { cancelSubscription } from "@/lib/square";

/**
 * POST /api/billing/cancel
 *
 * Square サブスクリプションのキャンセルリクエスト。
 *
 * 現時点（Payment Link / Sandbox フェーズ）では Square Subscriptions API を
 * 直接呼び出す実装は含まない。
 * 代わりに:
 *   1. DB の billing_status を 'canceled' に更新
 *   2. plan_type は current_period_end まで 'pro' のまま（フロント側で expired 判定）
 *
 * 本番の Square Subscriptions API を使う場合は、
 *   DELETE /v2/subscriptions/{subscription_id}
 * を呼び出す処理をここに追加する。
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // 現在のプロファイルを確認
  const { data: profile, error: fetchErr } = await admin
    .from("profiles")
    .select("plan_type, billing_status, square_subscription_id, current_period_end")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchErr || !profile) {
    return NextResponse.json({ error: "プロファイルの取得に失敗しました" }, { status: 500 });
  }

  if (profile.plan_type !== "pro") {
    return NextResponse.json({ error: "Proプランではありません" }, { status: 400 });
  }

  if (profile.billing_status === "canceled") {
    return NextResponse.json({ error: "すでに解約済みです" }, { status: 400 });
  }

  // Square Subscriptions API でサブスクリプションをキャンセル
  if (profile.square_subscription_id) {
    try {
      await cancelSubscription(profile.square_subscription_id as string);
      console.log(`[cancel] Square subscription canceled: ${profile.square_subscription_id}`);
    } catch (err) {
      console.error("[cancel] Square cancelSubscription error:", err);
      return NextResponse.json(
        { error: "Square でのキャンセル処理に失敗しました。しばらく後に再試行してください。" },
        { status: 500 },
      );
    }
  }

  // DB を更新（plan_type は current_period_end まで pro のまま）
  const { error: updateErr } = await admin
    .from("profiles")
    .update({
      billing_status: "canceled",
      canceled_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    message: "解約を受け付けました。current_period_end まで Pro をご利用いただけます。",
    current_period_end: profile.current_period_end,
  });
}
