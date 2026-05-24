import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { LPAnalysis } from "@/types";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { checkInputSize } from "@/lib/input-guard";
import { logRateLimitExceeded } from "@/lib/audit-logger";

const DESIGN_MOODS = [
  "ナチュラル・温かみ",
  "クール・スタイリッシュ",
  "かわいい・ポップ",
  "高級感・プレミアム",
  "信頼感・誠実",
  "元気・アクティブ",
];

export async function POST(req: NextRequest) {
  // ── サーバーサイド プラン・課金ガード ──
  const guard = await requirePlanGuard(req, { checkUsage: "analyze" });
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  // ── レートリミット ──
  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "analyze", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "analyze", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const { text, title, url } = body as { text: string; title?: string; url?: string };

    // ── 入力サイズ検証（テキストが HTML の場合があるので hasHtml を使用） ──
    const sizeCheck = checkInputSize(body as Record<string, unknown>, { hasHtml: true });
    if (sizeCheck) return sizeCheck;

    if (!text?.trim()) {
      return NextResponse.json({ error: "解析テキストがありません" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `あなたはLPデザイン・マーケティングの専門家です。
以下のWebページのテキストを分析し、LPの構成・デザイン傾向を抽出してください。

【著作権保護ルール（厳守）】
- 実際のテキスト・文章をそのまま出力しないでください
- 構成・役割・デザイン傾向のみを抽出・説明してください

【分析対象ページ】
タイトル：${title || "不明"}
URL：${url || "不明"}

【テキスト】
${text}

【出力形式】
以下のJSON構造のみを返してください（前後にテキスト不要）：

{
  "sections": [
    {
      "id": "スネークケースID（例：hero, problem, comparison, guarantee, flow, before_after, media, ceo_message）",
      "name": "日本語のセクション名（例：ファーストビュー、他社比較、代表メッセージ）",
      "role": "このセクションの役割（1文、例：競合との差別化を視覚的に訴求する）",
      "included": true,
      "order": 1
    }
  ],
  "colorTone": "色味の傾向（例：白・グレー基調のクリーンなデザイン、黒・金のプレミアム感）",
  "designMood": "${DESIGN_MOODS.join("\" または \"")}のいずれか1つ",
  "headlineTone": "見出しのトーン（例：問いかけ型、断言型、数字活用型、共感型、ベネフィット訴求型）",
  "appealFlow": "訴求の流れを簡潔に（例：共感→問題提起→解決策→実績→料金→保証→CTA）",
  "ctaStrength": "強い / 標準 / ソフト のいずれか（判断基準：ボタン数・カウントダウン・緊急性の有無）",
  "trustElements": ["信頼要素1", "信頼要素2"],
  "keywords": ["キーワード1", "キーワード2"],
  "hasFaq": true または false,
  "hasTestimonials": true または false,
  "hasPricing": true または false,
  "conversionStrategy": "このLPから学ぶべき訴求のポイント（2〜3文、著作権に配慮した構造的な説明）",
  "notes": "参考にする際の注意点（1〜2文）",
  "bubbleProblem": true または false （お悩みセクションが「吹き出し・チェックリスト・カード型・人物画像＋悩みテキスト配置」など視覚的な悩み訴求レイアウトの場合 true、通常のテキスト段落の場合 false）
}

【重要ルール】
- sectionsは上から順に、LPに実際に存在するセクションを全て列挙（最低5つ、最大15つ）
- 汎用的なLPセクション（ファーストビュー・お悩み・選ばれる理由等）だけでなく、このLPに固有のセクションも抽出
- designMoodは必ず指定の6択から1つ選ぶ
- 文章をそのまま引用しない（著作権保護）
- bubbleProblem：お悩み・問題提起セクションに「吹き出し形状・チェックリスト箇条書き・カード型配置・こんなお悩みありませんか、人物画像と悩みテキストが組み合わさった構成」が確認できる場合のみ true とする`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 3000,
      system:
        "You are a JSON API. Return only valid JSON, no markdown, no explanation.",
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<LPAnalysis>(raw);

    // Ensure sections have incremental order
    if (parsed.sections) {
      parsed.sections = parsed.sections.map((s, i) => ({
        ...s,
        order: i + 1,
        included: s.included !== false,
      }));
    }

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `LP分析に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
