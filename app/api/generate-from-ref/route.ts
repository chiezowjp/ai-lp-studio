import { NextRequest, NextResponse } from "next/server";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { LPAnalysis, AnalyzedSection, LPFormData } from "@/types";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { requirePlanGuard } from "@/lib/plan-guard";

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

function buildPrompt(
  analysis: LPAnalysis,
  selectedSections: AnalyzedSection[],
  serviceInfo: LPFormData,
  problemLayout: "normal" | "bubble" = "normal"
): string {
  const ctaLabel = CTA_LABELS[serviceInfo.ctaType] ?? "お問い合わせはこちら";

  const sectionList = selectedSections
    .map(
      (s, i) =>
        `${i + 1}. 【${s.name}】（class="lp-${s.id}"）\n   役割：${s.role}`
    )
    .join("\n");

  const trustList =
    analysis.trustElements?.length > 0
      ? analysis.trustElements.map((t) => `・${t}`).join("\n")
      : "・なし";

  return `あなたはプロのLP（ランディングページ）ライター兼デザイナーです。
以下の参考LP分析と作成するサービス情報をもとに、完全オリジナルのLPを生成してください。

━━━━━━━━━━━━━━━━━━━━
【著作権遵守ルール（絶対厳守）】
━━━━━━━━━━━━━━━━━━━━
・参考LPの文章・キャッチコピー・説明文を一切コピーしてはいけません
・参考LPのHTML・CSSをそのまま使用してはいけません
・構成・訴求の流れ・デザイントーンのみを参考にし、全文章は新規作成すること
・生成したLPはユーザーのサービスに特化した完全オリジナルコンテンツにすること

━━━━━━━━━━━━━━━━━━━━
【参考LP分析（構成の参考として活用）】
━━━━━━━━━━━━━━━━━━━━
■ デザイン傾向
・色味：${analysis.colorTone}
・雰囲気：${analysis.designMood}
・見出しのトーン：${analysis.headlineTone}

■ 訴求戦略（構成の参考として）
・訴求の流れ：${analysis.appealFlow}
・CTAの強さ：${analysis.ctaStrength}
・学ぶべきポイント：${analysis.conversionStrategy}

■ 信頼要素（参考として類似要素を採用可）
${trustList}

━━━━━━━━━━━━━━━━━━━━
【採用するセクション（この順番で生成）】
━━━━━━━━━━━━━━━━━━━━
${sectionList}

━━━━━━━━━━━━━━━━━━━━
【作成するサービス情報】
━━━━━━━━━━━━━━━━━━━━
・業種：${serviceInfo.industry}
・サービス名：${serviceInfo.serviceName}
・ターゲット：${serviceInfo.target}
・地域：${serviceInfo.area || "指定なし"}
・サービス内容：${serviceInfo.serviceDetail}
・価格：${serviceInfo.price || "未設定（料金セクションがある場合は「詳しくはお問い合わせを」とする）"}
・強み：${serviceInfo.strengths || "未設定"}
・デザイン雰囲気希望：${serviceInfo.designMood}
・CTA種別：${serviceInfo.ctaType}（ボタンラベル：「${ctaLabel}」）
・CTAリンク：${serviceInfo.ctaLink}

${problemLayout === "bubble" ? `━━━━━━━━━━━━━━━━━━━━
【お悩みセクション 吹き出しレイアウト指示（必須・厳守）】
━━━━━━━━━━━━━━━━━━━━
【方針】人物画像はHTMLに含めない。セクションの背景画像（CSS background-image）として後から設定する。
【必須】吹き出しを position:absolute で背景画像の上に重ねること。
【禁止】人物画像用の<img>タグ・<div>スロットをHTMLに含めないこと。

━━━ HTML構造（お悩みセクションのclass名に合わせて使うこと）━━━
<section class="lp-problem" data-bubble-layout="1">
  <div class="lp-problem__inner">
    <h2 class="lp-problem__heading">（見出し）</h2>
    <p class="lp-problem__sub">（サブ見出し）</p>
    <div class="lp-problem__board">
      <!-- 吹き出し（背景画像の上に絶対配置）-->
      <!-- 人物画像はセクション背景で設定するためHTMLには不要 -->
      <div class="lp-problem__bubble lp-problem__bubble--lt">😔 （お悩み文1）</div>
      <div class="lp-problem__bubble lp-problem__bubble--rt">💭 （お悩み文2）</div>
      <div class="lp-problem__bubble lp-problem__bubble--lm">😥 （お悩み文3）</div>
      <div class="lp-problem__bubble lp-problem__bubble--rm">😞 （お悩み文4）</div>
      <div class="lp-problem__bubble lp-problem__bubble--lb">🥲 （お悩み文5）</div>
      <div class="lp-problem__bubble lp-problem__bubble--rb">😩 （お悩み文6）</div>
    </div>
  </div>
</section>

━━━ CSS（<ACCENT>を${analysis.colorTone}に合うメインカラーに変更すること）━━━

/* セクション：人物背景画像を contain で中央表示 */
.lp-problem {
  padding: 5rem 1.5rem 6rem;
  background-color: #faf8f5;
  background-size: contain;
  background-position: center;
  background-repeat: no-repeat;
}
.lp-problem__inner { max-width: 960px; margin: 0 auto; text-align: center; }
.lp-problem__heading { font-size: clamp(1.4rem,3vw,2.2rem); margin-bottom: 0.5rem; }
.lp-problem__sub { color: #888; font-size: 0.95rem; margin-bottom: 2.5rem; }

/* ─── PC：吹き出しを背景画像の上に絶対配置 ─── */
.lp-problem__board {
  position: relative;
  min-height: 580px;
  max-width: 900px;
  margin: 0 auto;
}
/* 吹き出し共通 */
.lp-problem__bubble {
  position: absolute;
  z-index: 2;
  width: clamp(200px, 26vw, 320px);
  white-space: normal;
  word-break: normal;
  line-height: 1.7;
  background: #fff;
  border: 2px solid <ACCENT>;
  border-radius: 1.25rem;
  padding: 0.9rem 1.1rem;
  font-size: clamp(0.82rem, 1.2vw, 0.95rem);
  color: #3d2e20;
  text-align: left;
  box-shadow: 0 4px 16px rgba(0,0,0,.07);
}
/* 各吹き出しの位置 */
.lp-problem__bubble--lt { left:  2%; top:  6%; }
.lp-problem__bubble--rt { right: 2%; top:  9%; }
.lp-problem__bubble--lm { left:  0%; top: 37%; }
.lp-problem__bubble--rm { right: 0%; top: 40%; }
.lp-problem__bubble--lb { left:  5%; bottom: 7%; }
.lp-problem__bubble--rb { right: 5%; bottom: 7%; }
/* 左側テール：右向き */
.lp-problem__bubble--lt::after,
.lp-problem__bubble--lm::after,
.lp-problem__bubble--lb::after {
  content: ""; position: absolute;
  right: -17px; top: 50%; transform: translateY(-50%);
  border: 9px solid transparent; border-left-color: <ACCENT>;
}
.lp-problem__bubble--lt::before,
.lp-problem__bubble--lm::before,
.lp-problem__bubble--lb::before {
  content: ""; position: absolute;
  right: -11px; top: 50%; transform: translateY(-50%);
  border: 7px solid transparent; border-left-color: #fff; z-index: 1;
}
/* 右側テール：左向き */
.lp-problem__bubble--rt::after,
.lp-problem__bubble--rm::after,
.lp-problem__bubble--rb::after {
  content: ""; position: absolute;
  left: -17px; top: 50%; transform: translateY(-50%);
  border: 9px solid transparent; border-right-color: <ACCENT>;
}
.lp-problem__bubble--rt::before,
.lp-problem__bubble--rm::before,
.lp-problem__bubble--rb::before {
  content: ""; position: absolute;
  left: -11px; top: 50%; transform: translateY(-50%);
  border: 7px solid transparent; border-right-color: #fff; z-index: 1;
}
/* ─── スマホ：背景画像を上部、吹き出しを縦並びで下に ─── */
@media (max-width: 767px) {
  .lp-problem {
    background-position: center top;
    background-size: 75vw auto;
    padding-top: 75vw;
    padding-bottom: 3rem;
  }
  .lp-problem__board {
    position: static; min-height: auto;
    display: flex; flex-direction: column;
    align-items: flex-start; gap: 0.75rem; padding: 0 0.5rem;
  }
  .lp-problem__bubble { position: static; width: 80%; }
  .lp-problem__bubble--lt,.lp-problem__bubble--lm,.lp-problem__bubble--lb { margin-right: auto; }
  .lp-problem__bubble--rt,.lp-problem__bubble--rm,.lp-problem__bubble--rb { margin-left: auto; }
  .lp-problem__bubble--lt::after,.lp-problem__bubble--lm::after,.lp-problem__bubble--lb::after,
  .lp-problem__bubble--rt::after,.lp-problem__bubble--rm::after,.lp-problem__bubble--rb::after {
    right:auto;left:1.4rem;top:auto;bottom:-17px;transform:none;
    border-left-color:transparent;border-right-color:transparent;border-top-color:<ACCENT>;
  }
  .lp-problem__bubble--lt::before,.lp-problem__bubble--lm::before,.lp-problem__bubble--lb::before,
  .lp-problem__bubble--rt::before,.lp-problem__bubble--rm::before,.lp-problem__bubble--rb::before {
    right:auto;left:1.5rem;top:auto;bottom:-12px;transform:none;
    border-left-color:transparent;border-right-color:transparent;border-top-color:#fff;
  }
}

` : ""}━━━━━━━━━━━━━━━━━━━━
【HTML/CSS生成ルール】
━━━━━━━━━━━━━━━━━━━━
1. WordPressのカスタムHTMLブロックに直接貼り付けられるHTMLを生成
2. CSSはWordPressの「追加CSS」用を別途生成
3. スマホファースト（モバイルレスポンシブ、メディアクエリ使用）
4. フォントはNoto Sans JP（Google Fonts読み込み済み前提）
5. 各セクションのclass名は"lp-"プレフィックス必須（上記セクション一覧のclass名を使用）
6. 参考LPの「${analysis.designMood}」× 希望「${serviceInfo.designMood}」のデザイントーンで
7. 色使いは${analysis.colorTone}の傾向を参考に、オリジナルのカラーパレットで
8. 見出しは「${analysis.headlineTone}」のトーンで、サービスに合った完全オリジナルコピーを作成
9. CTAボタンは参考LPの「${analysis.ctaStrength}」に合わせた強さで配置
10. 「お客様の声」「口コミ」を含むセクションには <!-- ※お客様の声はサンプルです --> コメントを挿入
11. 各セクションに適切なHTMLコメント（<!-- lp-{セクションid}: セクション名 -->）を入れる
12. 全文章は${serviceInfo.industry}・${serviceInfo.serviceName}向けの完全オリジナルで作成

【出力形式】
前後に一切のテキスト不要。以下のJSONのみを返すこと：
{"html":"（完全なHTMLコード）","css":"（完全なCSSコード）"}`;
}

export async function POST(req: NextRequest) {
  // ── サーバーサイド プラン・課金ガード ──
  const guard = await requirePlanGuard(req, { checkUsage: "generate" });
  if (guard instanceof NextResponse) return guard;

  try {
    const {
      analysis,
      selectedSections,
      serviceInfo,
      problemLayout = "normal",
    }: {
      analysis: LPAnalysis;
      selectedSections: AnalyzedSection[];
      serviceInfo: LPFormData;
      problemLayout?: "normal" | "bubble";
    } = await req.json();

    if (!analysis || !selectedSections?.length || !serviceInfo) {
      return NextResponse.json({ error: "必要なパラメーターが不足しています" }, { status: 400 });
    }

    const required = ["industry", "target", "serviceName", "serviceDetail", "ctaType", "ctaLink"] as const;
    for (const key of required) {
      if (!serviceInfo[key]) {
        return NextResponse.json({ error: `${key} は必須です` }, { status: 400 });
      }
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildPrompt(analysis, selectedSections, serviceInfo, problemLayout),
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<{ html: string; css: string }>(raw);

    if (!parsed.html || !parsed.css) {
      throw new Error("AI出力の整形に失敗しました。再生成してください。");
    }

    return NextResponse.json({ html: parsed.html, css: parsed.css });
  } catch (err: unknown) {
    console.error("参考LP生成エラー:", err);

    if (err instanceof APIError && err.status === 529) {
      return NextResponse.json(
        { error: "現在AIが混み合っています。", type: "overloaded" },
        { status: 503 }
      );
    }

    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `LP生成に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
