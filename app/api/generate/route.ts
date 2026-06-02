import { NextRequest, NextResponse } from "next/server";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { LPFormData } from "@/types";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { checkInputSize, checkContentLength } from "@/lib/input-guard";
import { logRateLimitExceeded } from "@/lib/audit-logger";

const CTA_LABELS: Record<string, string> = {
  line: "LINEで予約する",
  phone: "今すぐ電話する",
  contact: "お問い合わせはこちら",
};

const SYSTEM_PROMPT = `あなたはJSON APIです。
ユーザーの指示に従い、必ず有効なJSONオブジェクトのみを返してください。
以下のルールを厳守してください：
- レスポンスは必ず { で始まり } で終わること
- JSONの前後に説明文・コメント・Markdownコードブロック（\`\`\`）を絶対に含めないこと
- JSON内の文字列値でダブルクォーテーション（"）を使う場合は必ず \\\" にエスケープすること
- JSON内の文字列値で改行を含める場合は \\n を使用すること
- 出力はJSONパーサーで直接パースできる形式のみとすること`;

function buildPrompt(data: LPFormData): string {
  const ctaLabel = CTA_LABELS[data.ctaType] ?? "お問い合わせはこちら";

  return `以下の情報をもとに、小規模店舗向けの日本語LP（ランディングページ）のHTML・CSSを生成してください。

【入力情報】
- 業種: ${data.industry}
- ターゲット: ${data.target}
- 地域: ${data.area}
- サービス名: ${data.serviceName}
- サービス内容: ${data.serviceDetail}
- 価格: ${data.price}
- 強み: ${data.strengths}
- デザイン雰囲気: ${data.designMood}
- CTAボタン: すべてのCTAボタンの href は "#" にすること（ユーザーが後でエディターで設定）。ラベルは「今すぐ試してみる」「お問い合わせはこちら」など行動を促す自然な表現にすること

【HTML/CSS要件】
1. WordPressのカスタムHTMLブロックに貼り付けられる完全なHTMLを生成すること
2. CSSはWordPressの「追加CSS」に貼り付けられる形式で別途生成すること
3. スマホファースト（モバイルレスポンシブ対応）
4. 以下のセクションを必ず含めること（クラス名は下記の通り厳守）：
   - <section class="lp-hero"> ：ファーストビュー。キャッチコピー、サブコピー、CTAボタン
   - <section class="lp-problem"> ：お悩みセクション。ターゲットの悩みを3〜4項目
   - <section class="lp-reason"> ：選ばれる理由。強みを3項目
   - <section class="lp-service"> ：サービス内容。具体的なサービス説明
   - <section class="lp-price"> ：料金。価格表
   - <section class="lp-testimonial"> ：お客様の声。2〜3件の架空レビュー
   - <section class="lp-faq"> ：よくある質問。3〜5件
   - <section class="lp-cta"> ：CTA。最終的な行動促進
   ※ 各セクションの最外殻要素は必ず上記クラス名のみを使用すること。
   ※ 内部要素のクラス名は lp-{セクション名}-{部品名} 形式にすること（例: lp-hero-inner, lp-faq-item）
5. CSSクラス名は "lp-" プレフィックスを使用すること
6. デザインは「${data.designMood}」の雰囲気に合わせること
7. 日本語らしい丁寧な文体で統一すること
8. 架空のお客様の声にはHTMLコメント「<!-- ※お客様の声はサンプルです -->」を入れること

【厳守事項】
あなたのレスポンス全体が以下のJSONオブジェクトそのものでなければなりません。
前後に一切のテキストを付けないでください。

{"html":"（ここにHTMLコード）","css":"（ここにCSSコード）"}`;
}

export async function POST(req: NextRequest) {
  // ── Content-Length 早期チェック ──
  const clCheck = checkContentLength(req);
  if (clCheck) return clCheck;

  // ── サーバーサイド プラン・課金ガード ──
  const guard = await requirePlanGuard(req, { checkUsage: "generate" });
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  // ── レートリミット（per-minute） ──
  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "generate", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "generate", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const data: LPFormData = await req.json();

    // ── 入力サイズ検証 ──
    const sizeCheck = checkInputSize(data as unknown as Record<string, unknown>, { maxBodyBytes: 20 * 1024 });
    if (sizeCheck) return sizeCheck;

    const required = ["industry", "target", "serviceName", "serviceDetail"] as const;
    for (const key of required) {
      if (!data[key]) {
        return NextResponse.json({ error: `${key} は必須です` }, { status: 400 });
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildPrompt(data) }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = extractAndParseJSON<{ html: string; css: string }>(raw);

    if (!parsed.html || !parsed.css) {
      throw new Error("AI出力の整形に失敗しました。再生成してください。");
    }

    return NextResponse.json({ html: parsed.html, css: parsed.css });
  } catch (err: unknown) {
    console.error("LP生成エラー:", err);

    // overloaded_error (529) は専用レスポンスを返してクライアント側でリトライさせる
    if (err instanceof APIError && err.status === 529) {
      return NextResponse.json(
        { error: "現在AIが混み合っています。", type: "overloaded" },
        { status: 503 }
      );
    }

    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: `LP生成に失敗しました: ${message}` }, { status: 500 });
  }
}
