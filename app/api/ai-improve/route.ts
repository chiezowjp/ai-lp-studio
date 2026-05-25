/**
 * POST /api/ai-improve
 *
 * LP の HTML + Analytics データを AI に渡し、CV 改善提案を生成する。
 * Pro プラン限定。analyze 使用量をカウント。
 */

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { requirePlanGuard } from "@/lib/plan-guard";
import { PLAN_LIMITS } from "@/lib/plans";
import { checkContentLength, checkInputSize } from "@/lib/input-guard";
import { getClientIp, checkRateLimitBoth } from "@/lib/rate-limiter";
import { logRateLimitExceeded, logAudit } from "@/lib/audit-logger";

// ─── 改善提案の型 ─────────────────────────────────────────────────────────────

export interface ImprovementSuggestion {
  /** 問題のカテゴリ */
  category: "cta" | "headline" | "form" | "firstview" | "color" | "layout" | "copy" | "trust";
  /** 問題の説明 */
  problem: string;
  /** 具体的な改善案 */
  suggestion: string;
  /** 改善の理由・根拠 */
  reason: string;
  /** 期待される効果 */
  expectedEffect: string;
  /** 優先度 */
  priority: "high" | "medium" | "low";
  /** 適用可能な場合の HTML パッチ（オプション） */
  htmlPatch?: string;
}

export interface AiImproveResult {
  suggestions: ImprovementSuggestion[];
  overallScore: number;       // 0〜100
  overallFeedback: string;
}

export async function POST(req: NextRequest) {
  // ── Content-Length 早期チェック ──
  const clCheck = checkContentLength(req);
  if (clCheck) return clCheck;

  // ── プラン・課金ガード（Pro 限定 + analyze 消費） ──
  const guard = await requirePlanGuard(req, { checkUsage: "analyze" });
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  if (!PLAN_LIMITS[planType].canAiImprove) {
    return NextResponse.json(
      { error: "AI改善提案は Pro プランでご利用いただけます。", code: "PLAN_LIMIT" },
      { status: 403 },
    );
  }

  // ── レートリミット ──
  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "analyze", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "ai-improve", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json() as {
      projectId?: string;
      html?: string;
      css?: string;
      formData?: Record<string, unknown>;
      analytics?: {
        totalPageViews?: number;
        uniqueVisitors?: number;
        ctaClickRate?: number;
        formOpenRate?: number;
        formSubmitRate?: number;
        scrollDepths?: { depth: number; count: number }[];
        deviceBreakdown?: { device: string; count: number }[];
      };
    };

    // ── 入力サイズ検証 ──
    const sizeCheck = checkInputSize(body as Record<string, unknown>, { hasHtml: true });
    if (sizeCheck) return sizeCheck;

    const { projectId, html, css, formData, analytics } = body;

    if (!html) {
      return NextResponse.json({ error: "html は必須です" }, { status: 400 });
    }

    // ── Analytics サマリー文字列 ──────────────────────────────────────────
    const analyticsText = analytics
      ? `
【Analytics データ（直近30日）】
- ページビュー: ${analytics.totalPageViews ?? "不明"}
- ユニーク訪問者: ${analytics.uniqueVisitors ?? "不明"}
- CTAクリック率: ${analytics.ctaClickRate != null ? (analytics.ctaClickRate * 100).toFixed(1) + "%" : "不明"}
- フォーム到達率: ${analytics.formOpenRate != null ? (analytics.formOpenRate * 100).toFixed(1) + "%" : "不明"}
- フォーム送信率: ${analytics.formSubmitRate != null ? (analytics.formSubmitRate * 100).toFixed(1) + "%" : "不明"}
- スクロール深度: ${analytics.scrollDepths?.map((d) => `${d.depth}%到達=${d.count}件`).join(", ") ?? "不明"}
- デバイス: ${analytics.deviceBreakdown?.map((d) => `${d.device}=${d.count}`).join(", ") ?? "不明"}
`.trim()
      : "【Analytics データ】なし（未計測）";

    const serviceText = formData
      ? `業種: ${formData.industry ?? "不明"}, サービス: ${formData.serviceName ?? "不明"}, ターゲット: ${formData.target ?? "不明"}`
      : "（サービス情報なし）";

    // HTML を 8KB に切り詰め（AI コンテキスト節約）
    const htmlSnippet = html.slice(0, 8000);

    const prompt = `あなたはランディングページ（LP）のCVR改善専門家です。
以下の LP と Analytics データを分析し、具体的な改善提案を JSON で返してください。

【サービス情報】
${serviceText}

${analyticsText}

【LP HTML（抜粋）】
${htmlSnippet}
${html.length > 8000 ? "\n（※ HTML が長いため省略）" : ""}

【CSS】
${(css ?? "").slice(0, 2000)}

【分析指示】
以下の観点で問題点を特定し、改善提案を作成してください：
1. ファーストビュー（Hero セクション）の訴求力
2. CTA ボタンの配置・テキスト・色
3. フォームの使いやすさ・入力項目数
4. 見出し・コピーの説得力
5. 信頼性要素（実績・お客様の声・証明）
6. スクロール誘導・導線設計
7. モバイル最適化
8. 色彩・デザインの統一感

Analytics から読み取れる問題（CTAクリック率が低い、フォーム到達率が低いなど）を優先的に指摘してください。

【出力 JSON 仕様】
以下のJSON のみ返してください（前後テキスト不要）：
{
  "suggestions": [
    {
      "category": "cta|headline|form|firstview|color|layout|copy|trust のいずれか",
      "problem": "現状の問題点（1〜2文）",
      "suggestion": "具体的な改善案（どう変えるか）",
      "reason": "なぜこの改善が効果的か（根拠）",
      "expectedEffect": "期待される効果（CVR +XX% などの目安があれば）",
      "priority": "high|medium|low"
    }
  ],
  "overallScore": 0〜100の整数（現状の LP スコア。60未満=要改善、60-79=普通、80+=良好）,
  "overallFeedback": "LP 全体の総評（2〜3文）"
}

提案は 4〜8 件、priority: high を少なくとも 2 件含めること。`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      system: "You are a JSON API. Return only valid JSON with no extra text, no markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<AiImproveResult>(raw);

    // 監査ログ（AI 消費）
    if (projectId) {
      logAudit({
        userId: user.id, action: "form_submit",
        targetType: "project", targetId: projectId,
        metadata: { type: "ai_improve", suggestions: parsed.suggestions?.length ?? 0 },
        req,
      });
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `AI改善提案の生成に失敗しました: ${message}` },
      { status: 500 },
    );
  }
}
