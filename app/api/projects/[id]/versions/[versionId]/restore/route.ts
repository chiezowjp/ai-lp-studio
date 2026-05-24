/**
 * POST /api/projects/[id]/versions/[versionId]/restore
 *
 * 指定バージョンの snapshot_json を現在の html / css / project_json に復元する。
 * Rollback 前に現在の状態を自動スナップショット保存する。
 * Pro プラン限定。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { logAudit } from "@/lib/audit-logger";

type RouteCtx = { params: Promise<{ id: string; versionId: string }> };

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId, versionId } = await ctx.params;
  const admin = createAdminClient();

  // ── オーナー確認 ──────────────────────────────────────────────────────────
  const [projectRes, profileRes, versionRes] = await Promise.all([
    admin.from("projects").select("id, user_id, html, css, project_json, title").eq("id", projectId).maybeSingle(),
    admin.from("profiles").select("plan_type, billing_status").eq("id", user.id).maybeSingle(),
    admin.from("versions").select("id, project_id, snapshot_json, trigger").eq("id", versionId).maybeSingle(),
  ]);

  if (!projectRes.data || projectRes.data.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!versionRes.data || versionRes.data.project_id !== projectId) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  const rawPlan = (profileRes.data?.plan_type ?? "trial") as PlanType;
  const planType: PlanType =
    profileRes.data?.billing_status === "expired" && rawPlan === "pro" ? "expired" : rawPlan;

  if (!PLAN_LIMITS[planType].canVersionHistory) {
    return NextResponse.json(
      { error: "Rollback は Pro プランでご利用いただけます。", code: "PLAN_LIMIT" },
      { status: 403 },
    );
  }

  const snapshot = versionRes.data.snapshot_json as {
    html?: string;
    css?: string;
    project_json?: Record<string, unknown>;
    title?: string;
  };

  if (!snapshot.html) {
    return NextResponse.json({ error: "Snapshot にデータがありません" }, { status: 400 });
  }

  // ── Rollback 前に現在の状態をスナップショット保存 ─────────────────────────
  await admin.from("versions").insert({
    project_id:    projectId,
    user_id:       user.id,
    snapshot_json: {
      html:         projectRes.data.html,
      css:          projectRes.data.css,
      project_json: projectRes.data.project_json,
      title:        projectRes.data.title,
    },
    trigger: "rollback",
    note:    `Rollback 前の自動保存（復元先: ${versionId.slice(0, 8)}）`,
  });

  // ── 復元実行 ──────────────────────────────────────────────────────────────
  const { data, error } = await admin
    .from("projects")
    .update({
      html:         snapshot.html,
      css:          snapshot.css ?? "",
      project_json: snapshot.project_json ?? {},
      updated_at:   new Date().toISOString(),
    })
    .eq("id", projectId)
    .select("id, title, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  logAudit({
    userId: user.id,
    action: "project_update",
    targetType: "project",
    targetId: projectId,
    metadata: { type: "rollback", versionId },
    req,
  });

  return NextResponse.json({ ok: true, project: data });
}
