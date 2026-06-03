import { NextRequest, NextResponse } from "next/server";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { LPAnalysis, LPFormData } from "@/types";
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

export async function POST(req: NextRequest) {
  // ── Content-Length 早期チェック ──
  const clCheck = checkContentLength(req);
  if (clCheck) return clCheck;

  // ── サーバーサイド プラン・課金ガード ──
  const guard = await requirePlanGuard(req, { checkUsage: "ai_edit" });
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  // ── レートリミット ──
  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "ai_edit", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "ai_edit", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const {
      sectionId,
      sectionName,
      sectionRole,
      analysis,
      serviceInfo,
      problemLayout = "normal",
    }: {
      sectionId: string;
      sectionName: string;
      sectionRole?: string;
      analysis?: LPAnalysis | null;
      serviceInfo: LPFormData;
      problemLayout?: "normal" | "bubble";
    } = await req.json();

    if (!sectionId || !serviceInfo) {
      return NextResponse.json({ error: "必要なパラメーターが不足しています" }, { status: 400 });
    }

    const ctaLabel = CTA_LABELS[serviceInfo.ctaType] ?? "お問い合わせはこちら";
    const designMood = analysis?.designMood ?? serviceInfo.designMood;
    const colorTone  = analysis?.colorTone  ?? "サービスのイメージに合った配色";

    const bubbleInstruction = problemLayout === "bubble" ? `
━━━━━━━━━━━━━━━━━━━━
【吹き出しレイアウト指示（必須・厳守）】
━━━━━━━━━━━━━━━━━━━━
【方針】人物画像はHTMLに含めない。セクションの背景画像（CSS background-image）として後から設定する。
【必須】吹き出しを position:absolute で背景画像の上に重ねること。
【禁止】人物画像用の<img>タグ・<div>スロットをHTMLに含めないこと。

━━━ HTML構造（このまま使うこと）━━━
<section class="lp-${sectionId}" data-bubble-layout="1">
  <div class="lp-${sectionId}__inner">
    <h2 class="lp-${sectionId}__heading">（見出し）</h2>
    <p class="lp-${sectionId}__subheading">（サブ見出し）</p>
    <div class="lp-${sectionId}__board">
      <!-- 吹き出し6個（背景画像の上に絶対配置）-->
      <!-- 人物画像はセクション背景で設定するためHTMLには不要 -->
      <div class="lp-${sectionId}__bubble lp-${sectionId}__bubble--lt">😔 （お悩み文1）</div>
      <div class="lp-${sectionId}__bubble lp-${sectionId}__bubble--rt">💭 （お悩み文2）</div>
      <div class="lp-${sectionId}__bubble lp-${sectionId}__bubble--lm">😥 （お悩み文3）</div>
      <div class="lp-${sectionId}__bubble lp-${sectionId}__bubble--rm">😞 （お悩み文4）</div>
      <div class="lp-${sectionId}__bubble lp-${sectionId}__bubble--lb">🥲 （お悩み文5）</div>
      <div class="lp-${sectionId}__bubble lp-${sectionId}__bubble--rb">😩 （お悩み文6）</div>
    </div>
  </div>
</section>

━━━ CSS（色は「${colorTone}」に沿ったメインカラーを#ACCENTに代入すること）━━━

/* セクション：人物背景画像を contain で中央表示 */
.lp-${sectionId} {
  padding: 5rem 1.5rem 6rem;
  background-color: #faf8f5;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}
.lp-${sectionId}__inner {
  max-width: 960px; margin: 0 auto; text-align: center;
}
.lp-${sectionId}__heading { font-size: clamp(1.4rem,3vw,2.2rem); margin-bottom: 0.5rem; }
.lp-${sectionId}__subheading { color: #888; font-size: 0.95rem; margin-bottom: 2.5rem; }

/* ─── PC：吹き出しを背景画像の上に絶対配置 ─── */
.lp-${sectionId}__board {
  position: relative;
  min-height: 580px;
  max-width: 900px;
  margin: 0 auto;
}
/* 吹き出し共通 */
.lp-${sectionId}__bubble {
  position: absolute;
  z-index: 2;
  width: clamp(200px, 26vw, 320px);
  white-space: normal;
  word-break: normal;
  line-height: 1.7;
  background: #fff;
  border: 2px solid #ACCENT;
  border-radius: 1.25rem;
  padding: 0.9rem 1.1rem;
  font-size: clamp(0.82rem, 1.2vw, 0.95rem);
  color: #3d2e20;
  text-align: left;
  box-shadow: 0 4px 16px rgba(0,0,0,.07);
}
/* 各吹き出しの位置 */
.lp-${sectionId}__bubble--lt { left:  2%; top:  6%; }
.lp-${sectionId}__bubble--rt { right: 2%; top:  9%; }
.lp-${sectionId}__bubble--lm { left:  0%; top: 37%; }
.lp-${sectionId}__bubble--rm { right: 0%; top: 40%; }
.lp-${sectionId}__bubble--lb { left:  5%; bottom: 7%; }
.lp-${sectionId}__bubble--rb { right: 5%; bottom: 7%; }

/* 左側テール：右向き */
.lp-${sectionId}__bubble--lt::after,
.lp-${sectionId}__bubble--lm::after,
.lp-${sectionId}__bubble--lb::after {
  content: ""; position: absolute;
  right: -17px; top: 50%; transform: translateY(-50%);
  border: 9px solid transparent;
  border-left-color: #ACCENT;
}
.lp-${sectionId}__bubble--lt::before,
.lp-${sectionId}__bubble--lm::before,
.lp-${sectionId}__bubble--lb::before {
  content: ""; position: absolute;
  right: -11px; top: 50%; transform: translateY(-50%);
  border: 7px solid transparent;
  border-left-color: #fff;
  z-index: 1;
}
/* 右側テール：左向き */
.lp-${sectionId}__bubble--rt::after,
.lp-${sectionId}__bubble--rm::after,
.lp-${sectionId}__bubble--rb::after {
  content: ""; position: absolute;
  left: -17px; top: 50%; transform: translateY(-50%);
  border: 9px solid transparent;
  border-right-color: #ACCENT;
}
.lp-${sectionId}__bubble--rt::before,
.lp-${sectionId}__bubble--rm::before,
.lp-${sectionId}__bubble--rb::before {
  content: ""; position: absolute;
  left: -11px; top: 50%; transform: translateY(-50%);
  border: 7px solid transparent;
  border-right-color: #fff;
  z-index: 1;
}

/* ─── スマホ：吹き出しを上、背景画像を下に ─── */
@media (max-width: 767px) {
  .lp-${sectionId} {
    background-position: center bottom;
    background-size: 75vw auto;
    padding-top: 2rem;
    padding-bottom: calc(75vw + 2rem); /* 画像分のスペースを下部に確保 */
  }
  .lp-${sectionId}__board {
    position: static;
    min-height: auto;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0 0.5rem;
  }
  .lp-${sectionId}__bubble {
    position: static;
    width: 80%;
  }
  .lp-${sectionId}__bubble--lt,
  .lp-${sectionId}__bubble--lm,
  .lp-${sectionId}__bubble--lb { margin-right: auto; }
  .lp-${sectionId}__bubble--rt,
  .lp-${sectionId}__bubble--rm,
  .lp-${sectionId}__bubble--rb { margin-left: auto; }
  /* スマホ：テールを下向きに変更 */
  .lp-${sectionId}__bubble--lt::after,
  .lp-${sectionId}__bubble--lm::after,
  .lp-${sectionId}__bubble--lb::after,
  .lp-${sectionId}__bubble--rt::after,
  .lp-${sectionId}__bubble--rm::after,
  .lp-${sectionId}__bubble--rb::after {
    right: auto; left: 1.4rem; top: auto; bottom: -17px;
    transform: none;
    border-left-color: transparent;
    border-right-color: transparent;
    border-top-color: #ACCENT;
  }
  .lp-${sectionId}__bubble--lt::before,
  .lp-${sectionId}__bubble--lm::before,
  .lp-${sectionId}__bubble--lb::before,
  .lp-${sectionId}__bubble--rt::before,
  .lp-${sectionId}__bubble--rm::before,
  .lp-${sectionId}__bubble--rb::before {
    right: auto; left: 1.5rem; top: auto; bottom: -12px;
    transform: none;
    border-left-color: transparent;
    border-right-color: transparent;
    border-top-color: #fff;
  }
}

━━━ 注意事項 ━━━
・#ACCENT は「${colorTone}」のイメージに合う実際の色コードに必ず置き換えること
・吹き出しは3〜6個。少ない場合は--lt/--rt/--lm/--rm の4個から使い--lb/--rb を省略してよい
・各吹き出しの先頭に悩み系絵文字（😔 💭 😥 😞 🥲 😩 など）を必ず入れる
・吹き出し文は「${serviceInfo.industry}」利用者が感じる具体的な悩みにすること
・人物画像はHTMLに含めない。ユーザーが左メニュー「画像設定」でセクション背景として後から設定する
` : "";

    const analysisBlock = analysis ? `
━━━━━━━━━━━━━━━━━━━━
【参考LP分析（デザイン・トーンの参考）】
━━━━━━━━━━━━━━━━━━━━
・色味：${colorTone}
・雰囲気：${designMood}
・見出しトーン：${analysis.headlineTone}
・学ぶべきポイント：${analysis.conversionStrategy}` : "";

    const prompt = `あなたはプロのLPライター兼デザイナーです。
以下の条件でLPの1セクションのみを生成してください。

━━━━━━━━━━━━━━━━━━━━
【生成するセクション】
━━━━━━━━━━━━━━━━━━━━
・セクション名：${sectionName}
・役割：${sectionRole ?? "ターゲットのお悩み・問題を提起し共感を得る"}
・class名：lp-${sectionId}（必須）
${analysisBlock}
${bubbleInstruction}
━━━━━━━━━━━━━━━━━━━━
【作成するサービス情報】
━━━━━━━━━━━━━━━━━━━━
・業種：${serviceInfo.industry}
・サービス名：${serviceInfo.serviceName}
・ターゲット：${serviceInfo.target}
・地域：${serviceInfo.area || "指定なし"}
・サービス内容：${serviceInfo.serviceDetail}
・強み：${serviceInfo.strengths || "未設定"}
・デザイン雰囲気：${designMood}
・CTA：${ctaLabel}

━━━━━━━━━━━━━━━━━━━━
【HTML/CSS生成ルール】
━━━━━━━━━━━━━━━━━━━━
1. 1セクション分のHTMLのみを生成（<section>または<div>タグ1つ）
2. class="lp-${sectionId}" を必ず付与
3. スマホファースト・レスポンシブ対応
4. フォントはNoto Sans JP前提
5. 「${designMood}」のデザイントーン
6. 全文章は${serviceInfo.industry}・${serviceInfo.serviceName}向けの完全オリジナル
7. CSSはこのセクション専用のスタイルのみ

【出力形式】
前後に一切のテキスト不要。以下のJSONのみを返すこと：
{"html":"（セクション1つのHTMLのみ）","css":"（このセクション専用CSSのみ）"}`;

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 6000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<{ html: string; css: string }>(raw);

    if (!parsed.html) {
      throw new Error("セクション生成に失敗しました。再試行してください。");
    }

    return NextResponse.json({ html: parsed.html, css: parsed.css ?? "" });
  } catch (err: unknown) {
    console.error("セクション再生成エラー:", err);

    if (err instanceof APIError && err.status === 529) {
      return NextResponse.json(
        { error: "現在AIが混み合っています。", type: "overloaded" },
        { status: 503 }
      );
    }

    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `セクション生成に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
