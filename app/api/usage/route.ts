import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

// ─── GET /api/usage  ── 使用量を返す ─────────────────────────────────────────
//
// カウント開始点の決定ルール:
//   1. profiles.usage_reset_at が存在し、かつ今月開始より新しい → usage_reset_at から集計
//   2. それ以外 → 今月開始（従来のカレンダー月次集計）
//
// Pro 化した瞬間に usage_reset_at をセットすることで
// Trial 中の使用量をリセットし、Pro から改めてカウントを開始できる。
// サブスク更新 Webhook でも usage_reset_at を更新し、月次リセットを実現する。

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // プロファイルから usage_reset_at を取得
  const { data: profile } = await admin
    .from("profiles")
    .select("usage_reset_at")
    .eq("id", user.id)
    .maybeSingle();

  // 今月開始日時（UTC）
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();

  // カウント開始点: usage_reset_at が月開始より新しければそちらを優先
  const usageResetAt = profile?.usage_reset_at ?? null;
  const countFrom =
    usageResetAt && usageResetAt > monthStart ? usageResetAt : monthStart;

  const { data, error } = await admin
    .from("usage_events")
    .select("event_type")
    .eq("user_id", user.id)
    .gte("created_at", countFrom);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const counts = { generate: 0, analyze: 0, ai_edit: 0 };
  for (const row of data ?? []) {
    if (row.event_type === "generate") counts.generate++;
    if (row.event_type === "analyze")  counts.analyze++;
    if (row.event_type === "ai_edit")  counts.ai_edit++;
  }

  return NextResponse.json(counts);
}

// ─── POST /api/usage  ── 使用イベントを記録 ──────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { event_type?: string };
  const { event_type } = body;

  if (!["generate", "analyze", "ai_edit"].includes(event_type ?? "")) {
    return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("usage_events").insert({
    user_id: user.id,
    event_type,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
