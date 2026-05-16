import { NextRequest, NextResponse } from "next/server";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { LPAnalysis, AnalyzedSection, LPFormData } from "@/types";
import { extractAndParseJSON } from "@/lib/parseAIJson";

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
  serviceInfo: LPFormData
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

━━━━━━━━━━━━━━━━━━━━
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
  try {
    const {
      analysis,
      selectedSections,
      serviceInfo,
    }: {
      analysis: LPAnalysis;
      selectedSections: AnalyzedSection[];
      serviceInfo: LPFormData;
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
          content: buildPrompt(analysis, selectedSections, serviceInfo),
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
