/**
 * GET /api/analytics/[projectId]
 *
 * プロジェクトの Analytics ダッシュボードデータを返す。
 * Pro プランのプロジェクトオーナーのみ取得可能。
 *
 * Query params:
 *   days — 集計日数（デフォルト 30、最大 90）
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { aggregateAnalytics, type RawAnalyticsRow } from "@/lib/analytics";

type RouteCtx = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { projectId } = await ctx.params;
  const admin = createAdminClient();

  // ── プロジェクト所有者確認 ────────────────────────────────────────────────
  const { data: project } = await admin
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .maybeSingle();

  if (!project || project.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // ── プラン確認（Pro 限定） ────────────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_type, billing_status")
    .eq("id", user.id)
    .maybeSingle();

  const rawPlan = (profile?.plan_type ?? "trial") as PlanType;
  const planType: PlanType =
    profile?.billing_status === "expired" && rawPlan === "pro" ? "expired" : rawPlan;

  if (!PLAN_LIMITS[planType].canViewAnalytics) {
    return NextResponse.json(
      { error: "Analytics は Pro プランでご利用いただけます。", code: "PLAN_LIMIT" },
      { status: 403 },
    );
  }

  // ── 集計期間 ──────────────────────────────────────────────────────────────
  const { searchParams } = req.nextUrl;
  const days = Math.min(90, Math.max(1, Number(searchParams.get("days") ?? 30)));
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // ── データ取得 ────────────────────────────────────────────────────────────
  const { data: rows, error } = await admin
    .from("analytics_events")
    .select("event_type, visitor_id, session_id, metadata, created_at, device_type, referrer")
    .eq("project_id", projectId)
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(50_000); // 上限50,000行

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = aggregateAnalytics((rows ?? []) as RawAnalyticsRow[]);

  return NextResponse.json({ ...summary, days, projectId });
}
