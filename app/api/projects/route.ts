import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { requirePlanGuard } from "@/lib/plan-guard";

// ─── GET /api/projects  ── ユーザーのプロジェクト一覧 ──────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .select("id, title, html, css, project_json, thumbnail, is_published, slug, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── POST /api/projects  ── 新規作成 ──────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── サーバーサイド プラン・課金ガード（プロジェクト数上限チェック） ──
  const guard = await requirePlanGuard(req, { checkProjectCount: true });
  if (guard instanceof NextResponse) return guard;
  const { user } = guard;

  const body = await req.json();
  const { title, html, css, project_json } = body as {
    title: string;
    html: string;
    css: string;
    project_json: Record<string, unknown>;
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("projects")
    .insert({ user_id: user.id, title, html, css, project_json })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
