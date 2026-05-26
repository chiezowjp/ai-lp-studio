import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

/** 開発・テスト用: 自分のプランをトライアルにリセットする一時エンドポイント */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({
    plan_type: "trial",
    billing_status: "trialing",
    current_period_end: null,
    grace_period_ends_at: null,
    canceled_at: null,
  }).eq("id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, message: "プランをトライアルにリセットしました" });
}
