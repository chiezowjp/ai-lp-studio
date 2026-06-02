import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit-logger";

type RouteCtx = { params: Promise<{ id: string }> };

// ─── GET /api/projects/[id]  ── 取得 ──────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("projects")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

// ─── PUT /api/projects/[id]  ── 更新 ──────────────────────────────────────────

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const body = await req.json();
  const { title, html, css, effective_css, project_json } = body as {
    title: string;
    html: string;
    css: string;
    effective_css?: string;
    project_json: Record<string, unknown>;
  };

  const admin = createAdminClient();

  // effective_css を project_json に含める
  const mergedProjectJson = effective_css
    ? { ...project_json, effective_css }
    : project_json;

  // 所有者確認と更新を1クエリに統合（user_id 条件を WHERE に含める）。
  // 公開済みかどうかは返却データで判定し、必要なら published_html/css を追加更新。
  const { data, error } = await admin
    .from("projects")
    .update({
      title,
      html,
      css,
      project_json: mergedProjectJson,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, is_published, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)  return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 公開済みなら published_html/css も更新（別クエリだが軽量）
  if (data.is_published) {
    await admin
      .from("projects")
      .update({
        published_html: html,
        published_css:  effective_css ?? css,
      })
      .eq("id", id);
  }

  return NextResponse.json(data);
}

// ─── PATCH /api/projects/[id]  ── タイトルのみ更新 ───────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { title } = await req.json() as { title: string };

  if (!title || title.trim().length === 0) {
    return NextResponse.json({ error: "タイトルを入力してください" }, { status: 400 });
  }

  const admin = createAdminClient();

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
    .update({ title: title.trim(), updated_at: new Date().toISOString() })
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
