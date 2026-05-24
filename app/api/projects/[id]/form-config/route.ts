/**
 * GET  /api/projects/[id]/form-config — フォーム設定取得
 * PATCH /api/projects/[id]/form-config — フォーム設定保存
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import type { FormConfig } from "@/lib/form-schema";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-schema";

type RouteCtx = { params: Promise<{ id: string }> };

/** オーナー確認ヘルパー */
async function getOwnedProject(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  projectId: string,
) {
  const { data } = await admin
    .from("projects")
    .select("id, user_id, form_config, slug, is_published")
    .eq("id", projectId)
    .maybeSingle();

  if (!data || data.user_id !== userId) return null;
  return data;
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const project = await getOwnedProject(admin, user.id, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = (project.form_config as FormConfig | null) ?? DEFAULT_FORM_CONFIG;
  return NextResponse.json(config);
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();
  const project = await getOwnedProject(admin, user.id, id);
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json()) as Partial<FormConfig>;

  // 現在の設定とマージ
  const current: FormConfig = (project.form_config as FormConfig | null) ?? DEFAULT_FORM_CONFIG;
  const merged: FormConfig = { ...current, ...body };

  const { data, error } = await admin
    .from("projects")
    .update({ form_config: merged, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select("id, form_config")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data.form_config);
}
