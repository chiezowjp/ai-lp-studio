import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

/**
 * GET /api/billing/events
 * 現在ユーザーの課金イベント履歴を返す（新しい順・最大 50 件）。
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("billing_events")
    .select(
      "id, square_event_id, event_type, billing_status, amount, currency, processed_at",
    )
    .eq("user_id", user.id)
    .order("processed_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
