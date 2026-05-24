import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

/**
 * GET /api/admin/billing
 * 全ユーザーの課金ステータスを返す（管理者専用）。
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // 管理者確認
  const { data: myProfile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 全ユーザーの課金情報を返す
  const { data, error } = await admin
    .from("profiles")
    .select(
      "id, plan_type, trial_ends_at, is_admin, billing_status, current_period_end, canceled_at, square_subscription_id",
    )
    .order("plan_type");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
