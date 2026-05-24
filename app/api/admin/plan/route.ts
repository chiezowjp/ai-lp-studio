import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

// ─── POST /api/admin/plan  ── 管理者がユーザーのプランを変更する ───────────────

export async function POST(req: NextRequest) {
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

  const body = await req.json();
  const { target_user_id, plan_type } = body as {
    target_user_id: string;
    plan_type: "trial" | "pro" | "expired";
  };

  if (!target_user_id || !["trial", "pro", "expired"].includes(plan_type)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const trialEndsAt = plan_type === "trial"
    ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await admin
    .from("profiles")
    .upsert({
      id: target_user_id,
      plan_type,
      trial_ends_at: trialEndsAt,
      is_admin: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── GET /api/admin/plan  ── ユーザー一覧（管理者専用）─────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: myProfile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 全ユーザーのプロファイルを返す
  const { data, error } = await admin
    .from("profiles")
    .select("id, plan_type, trial_ends_at, is_admin")
    .order("plan_type");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
