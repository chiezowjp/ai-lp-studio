/**
 * GET  /api/projects/[id]/versions — バージョン一覧取得
 * POST /api/projects/[id]/versions — バージョン手動保存
 *
 * Pro プラン限定。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { logAudit } from "@/lib/audit-logger";

type RouteCtx = { params: Promise<{ id: string }> };

// ─── オーナー確認 + プラン確認 ────────────────────────────────────────────────

async function getGuard(userId: string, projectId: string) {
  const admin = createAdminClient();

  const [projectRes, profileRes] = await Promise.all([
    admin.from("projects").select("id, user_id, title, html, css, project_json").eq("id", projectId).maybeSingle(),
    admin.from("profiles").select("plan_type, billing_status").eq("id", userId).maybeSingle(),
  ]);

  if (!projectRes.data || projectRes.data.user_id !== userId) return null;

  const rawPlan = (profileRes.data?.plan_type ?? "trial") as PlanType;
  const planType: PlanType =
    profileRes.data?.billing_status === "expired" && rawPlan === "pro" ? "expired" : rawPlan;

  return { project: projectRes.data, planType, admin };
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const g = await getGuard(user.id, id);
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!PLAN_LIMITS[g.planType].canVersionHistory) {
    return NextResponse.json(
      { error: "Version履歴は Pro プランでご利用いただけます。", code: "PLAN_LIMIT" },
      { status: 403 },
    );
  }

  const { data, error } = await g.admin
    .from("versions")
    .select("id, project_id, trigger, note, created_at, snapshot_json->title")
    .eq("project_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}

// ─── POST — 手動スナップショット作成 ─────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const g = await getGuard(user.id, id);
  if (!g) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!PLAN_LIMITS[g.planType].canVersionHistory) {
    return NextResponse.json(
      { error: "Version履歴は Pro プランでご利用いただけます。", code: "PLAN_LIMIT" },
      { status: 403 },
    );
  }

  const body = await req.json() as { note?: string; trigger?: string };
  const trigger = (["publish", "rollback", "manual", "ai_improve", "auto"].includes(body.trigger ?? ""))
    ? body.trigger as "publish" | "rollback" | "manual" | "ai_improve" | "auto"
    : "manual";

  const { error, data } = await g.admin.from("versions").insert({
    project_id:    id,
    user_id:       user.id,
    snapshot_json: {
      html:         g.project.html,
      css:          g.project.css,
      project_json: g.project.project_json,
      title:        g.project.title,
    },
    trigger,
    note: body.note ?? null,
  }).select("id, created_at, trigger, note").single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({ userId: user.id, action: "project_update", targetType: "version", targetId: id, metadata: { trigger, note: body.note }, req });

  return NextResponse.json(data, { status: 201 });
}
