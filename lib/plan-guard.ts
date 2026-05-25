/**
 * lib/plan-guard.ts — サーバーサイド プラン・課金ガード
 *
 * すべての API Route から呼び出せる中央集権的なアクセス制御ユーティリティ。
 * フロントエンドの制限だけに頼らず、curl 直叩きでもバイパスできないようにする。
 *
 * 検証内容:
 *   1. Authorization ヘッダーから user を取得（未認証 → 401）
 *   2. profiles から plan_type + billing_status を取得
 *   3. billing_status が "expired" なら plan_type を強制的に "expired" 扱い
 *   4. expired プランは全 AI 機能をブロック（→ 403）
 *   5. Pro 限定機能は plan_type !== "pro" でブロック（→ 403）
 *   6. 使用量上限チェック（generate / analyze / ai_edit → 429）
 *   7. プロジェクト数上限チェック（→ 429）
 */

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType, UsageEventType } from "@/lib/plans";
import type { User } from "@supabase/supabase-js";

// ─── 返却型 ───────────────────────────────────────────────────────────────────

export interface GuardResult {
  user: User;
  planType: PlanType;
  billingStatus: string;
}

// ─── オプション ───────────────────────────────────────────────────────────────

export interface GuardOptions {
  /**
   * 使用量チェックするイベント種別。
   * 指定した場合、現在の月間使用量がプラン上限に達していれば 429 を返す。
   */
  checkUsage?: UsageEventType;

  /**
   * true の場合、pro プランのみ許可。trial / expired は 403 を返す。
   */
  requirePro?: boolean;

  /**
   * true の場合、プロジェクト数上限をチェックする（POST /api/projects 用）。
   */
  checkProjectCount?: boolean;
}

// ─── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * API Route の先頭で呼び出すガード関数。
 *
 * @returns GuardResult（通過） or NextResponse（ブロック — そのまま return）
 *
 * @example
 * export async function POST(req: NextRequest) {
 *   const guard = await requirePlanGuard(req, { checkUsage: "generate" });
 *   if (guard instanceof NextResponse) return guard;
 *   const { user, planType } = guard;
 *   // ... 処理続行
 * }
 */
export async function requirePlanGuard(
  req: NextRequest,
  options: GuardOptions = {},
): Promise<GuardResult | NextResponse> {
  // ── 1. 認証チェック ──────────────────────────────────────────────────────────
  const user = await getUserFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  // ── 2. プロファイル取得 ───────────────────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_type, billing_status, usage_reset_at")
    .eq("id", user.id)
    .maybeSingle();

  const rawPlanType     = (profile?.plan_type      ?? "trial")    as PlanType;
  const billingStatus   = (profile?.billing_status  ?? "trialing") as string;
  const usageResetAt    = (profile?.usage_reset_at  ?? null)       as string | null;

  // ── 3. 実効プランを決定（billing_status が expired なら強制 expired 扱い）──
  const planType: PlanType =
    billingStatus === "expired" && rawPlanType === "pro" ? "expired" : rawPlanType;

  // ── 4. expired は全 AI 機能ブロック ──────────────────────────────────────────
  if (planType === "expired") {
    return NextResponse.json(
      {
        error: "プランの有効期限が切れています。プランを更新してください。",
        code: "PLAN_EXPIRED",
      },
      { status: 403 },
    );
  }

  // ── 5. Pro 限定チェック ───────────────────────────────────────────────────────
  if (options.requirePro && planType !== "pro") {
    return NextResponse.json(
      {
        error: "この機能は Pro プランでご利用いただけます。",
        code: "PLAN_LIMIT",
      },
      { status: 403 },
    );
  }

  // ── 6. 使用量上限チェック ─────────────────────────────────────────────────────
  if (options.checkUsage) {
    const limit = PLAN_LIMITS[planType];
    let maxCount: number;
    if (options.checkUsage === "generate") maxCount = limit.maxGenerate;
    else if (options.checkUsage === "analyze") maxCount = limit.maxAnalyze;
    else maxCount = limit.maxAiEdit; // ai_edit

    if (maxCount === 0) {
      return NextResponse.json(
        {
          error: "現在のプランでは利用できません。",
          code: "PLAN_LIMIT",
        },
        { status: 403 },
      );
    }

    // 今月開始 or usage_reset_at の新しい方からカウント
    const now        = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    const countFrom  = usageResetAt && usageResetAt > monthStart ? usageResetAt : monthStart;

    const { count } = await admin
      .from("usage_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("event_type", options.checkUsage)
      .gte("created_at", countFrom);

    if ((count ?? 0) >= maxCount) {
      return NextResponse.json(
        {
          error: `今月の${usageLabel(options.checkUsage)}上限（${maxCount}回）に達しました。`,
          code: "USAGE_LIMIT",
          used:  count ?? 0,
          limit: maxCount,
        },
        { status: 429 },
      );
    }
  }

  // ── 7. プロジェクト数上限チェック ────────────────────────────────────────────
  if (options.checkProjectCount) {
    const maxProjects = PLAN_LIMITS[planType].maxProjects;

    if (maxProjects === 0) {
      return NextResponse.json(
        { error: "現在のプランではプロジェクトを作成できません。", code: "PLAN_LIMIT" },
        { status: 403 },
      );
    }

    const { count } = await admin
      .from("projects")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= maxProjects) {
      return NextResponse.json(
        {
          error: `プロジェクト数の上限（${maxProjects}件）に達しています。`,
          code: "PROJECT_LIMIT",
          used:  count ?? 0,
          limit: maxProjects,
        },
        { status: 429 },
      );
    }
  }

  return { user, planType, billingStatus };
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

function usageLabel(type: UsageEventType): string {
  if (type === "generate") return "LP生成";
  if (type === "analyze")  return "LP解析";
  return "AI編集";
}
