import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit-logger";

type RouteCtx = { params: Promise<{ id: string }> };

// ─── PUT /api/projects/[id]  ── 更新 ──────────────────────────────────────────

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const { title, html, css, project_json } = body as {
    title: string;
    html: string;
    css: string;
    project_json: Record<string, unknown>;
  };

  const admin = createAdminClient();

  // 所有者確認
  const { data: existing } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("projects")
    .update({ title, html, css, project_json, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// ─── DELETE /api/projects/[id]  ── 削除 ───────────────────────────────────────

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // 所有者確認
  const { data: existing } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", id)
    .single();
  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin.from("projects").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 監査ログ
  logAudit({ userId: user.id, action: "delete_project", targetType: "project", targetId: id, req });

  return NextResponse.json({ ok: true });
}
