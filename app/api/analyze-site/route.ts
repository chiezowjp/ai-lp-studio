import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { ExtractedSiteData } from "@/types";

const DESIGN_MOODS = [
  "ナチュラル・温かみ",
  "クール・スタイリッシュ",
  "かわいい・ポップ",
  "高級感・プレミアム",
  "信頼感・誠実",
  "元気・アクティブ",
];

export async function POST(req: NextRequest) {
  try {
    const {
      text,
      title,
      url,
    }: { text: string; title?: string; url?: string } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json(
        { error: "解析するテキストがありません" },
        { status: 400 }
      );
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `あなたはWebサイトのテキストからビジネス情報を抽出する専門家です。
以下のWebサイトのテキストを解析して、LP（ランディングページ）生成に必要な情報を抽出してください。

【サイト情報】
タイトル：${title || "不明"}
URL：${url || "不明"}

【サイトテキスト】
${text}

【抽出項目と指示】
- serviceName：サービス名・店舗名・会社名（わからない場合はタイトルを使用）
- industry：業種カテゴリ（例：整骨院、美容室、税理士事務所、飲食店、EC、コンサルティング）
- target：主なターゲット顧客（具体的に。例：30〜50代の腰痛に悩む女性）
- area：営業エリア・対応地域（例：東京都渋谷区、全国対応）見つからなければ空文字
- serviceDetail：サービス内容の詳細（2〜3文で具体的に）
- price：料金・価格情報（見つからなければ空文字）
- strengths：強み・特徴・アピールポイント（箇条書き3〜5項目、「・」区切り）
- designMood：サイトの雰囲気から推定するデザイントーン（必ず次のいずれかを選択：${DESIGN_MOODS.join("、")}）
- ctaType：主な問い合わせ方法（"line"＝LINE、"phone"＝電話、"contact"＝フォーム のいずれか1つ）
- ctaLink：LINEのURL、電話番号、問い合わせページURL（見つかったもの1つ）
- address：住所（見つからなければ空文字）
- phone：電話番号（見つからなければ空文字）
- businessHours：営業時間・定休日（見つからなければ空文字）
- seoKeywords：SEO的に重要なキーワード（カンマ区切りで5〜10個）
- frequentWords：テキスト中で頻繁に登場する特徴的なキーワード（カンマ区切りで5〜10個）
- imageStyle：このビジネスに合う画像・デザインの雰囲気（1文、例：「明るく清潔感のある白基調の写真」）

【重要ルール】
- 情報が見つからない項目は空文字（""）にしてください
- 「不明」「なし」などの文字列は書かないでください
- designMoodは必ず指定した6つの選択肢から1つだけ選んでください
- ctaTypeは必ず "line"/"phone"/"contact" のいずれか1つにしてください

以下のJSONのみを返してください（前後に一切テキスト不要）：
{"serviceName":"","industry":"","target":"","area":"","serviceDetail":"","price":"","strengths":"","designMood":"","ctaType":"","ctaLink":"","address":"","phone":"","businessHours":"","seoKeywords":"","frequentWords":"","imageStyle":""}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: "You are a JSON API. Return only valid JSON with no extra text, no markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<ExtractedSiteData>(raw);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `解析に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
