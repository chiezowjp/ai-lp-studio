import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { requirePlanGuard } from "@/lib/plan-guard";

type RouteCtx = { params: Promise<{ id: string }> };

// ─── POST /api/projects/[id]/duplicate  ── サーバーサイド複製 ──────────────────
// html / css / project_json をクライアントに送らずにサーバー側で SELECT → INSERT する

export async function POST(req: NextRequest, ctx: RouteCtx) {
  // プラン・プロジェクト数上限チェック
  const guard = await requirePlanGuard(req, { checkProjectCount: true });
  if (guard instanceof NextResponse) return guard;
  const { user } = guard;

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // コピー元を取得（所有者確認を兼ねる）
  const { data: src, error: fetchErr } = await admin
    .from("projects")
    .select("user_id, title, html, css, project_json")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchErr || !src) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // 新規プロジェクトとして INSERT
  const { data: created, error: insertErr } = await admin
    .from("projects")
    .insert({
      user_id: user.id,
      title: `${src.title} のコピー`,
      html: src.html,
      css: src.css,
      project_json: src.project_json,
    })
    .select("id, title, thumbnail, is_published, slug, created_at, updated_at")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json(created, { status: 201 });
}
