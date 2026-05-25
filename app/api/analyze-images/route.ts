import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { ImageToneAnalysis } from "@/types";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { logRateLimitExceeded } from "@/lib/audit-logger";

const MAX_IMAGES = 5;

// ─── Analyze a single image via Claude vision ─────────────────────────────────

async function analyzeImage(
  client: Anthropic,
  imageUrl: string,
  industry: string,
  serviceName: string
): Promise<ImageToneAnalysis | null> {
  try {
    const prompt = `この画像をLP（ランディングページ）のデザイン参考として分析してください。

【対象サービス】業種：${industry} / サービス名：${serviceName}

【著作権保護ルール】
この画像をそのままコピーするプロンプトは作成しないでください。
構図・色味・明るさ・余白の使い方・雰囲気のみを参考にした、完全オリジナルのプロンプトを作成してください。

以下のJSONのみを返してください（前後に説明不要）：
{
  "placement": "使用場所の推定（ファーストビュー背景 / サービス紹介 / 背景テクスチャ / CTA背景 / 人物写真 / その他 のいずれか）",
  "composition": "構図の説明（1文、例：左側に余白を取り右側に被写体を配置したリードルーム構図）",
  "colorTone": "色味の傾向（1文、例：ベージュ・オフホワイト基調の柔らかいトーン）",
  "brightness": "明るさ（明るい / やや明るい / 自然 / やや暗い / 暗い のいずれか）",
  "hasPeople": true または false,
  "ageGroup": "人物の年齢層（hasPeopleがtrueの場合のみ。例：20〜30代女性、中年男性など。falseの場合は空文字）",
  "whiteSpace": "余白の取り方（1文、例：上部30%が空白でテキスト配置に適している）",
  "mood": "全体的な印象・雰囲気（例：高級感、ナチュラル、清潔感、信頼感、温かみ、プロフェッショナル）",
  "textFriendly": true または false（テキストを重ねて使いやすい構図・明るさか）,
  "promptJa": "${industry}・${serviceName}向けの日本語画像生成プロンプト（150〜200文字）。この画像の雰囲気・構図・色味を参考にしたオリジナル。実際のサービスに合わせて完全新規作成。",
  "promptEn": "English image generation prompt for ${industry} service (80-120 words). Inspired by the composition and mood of this reference image. Completely original concept.",
  "promptMidjourney": "Midjourney v6 format: comma-separated tags, end with --ar 16:9 --style raw --v 6",
  "promptChatGPT": "DALL-E 3 format starting with 'A professional photo of...' with size specification",
  "promptCanva": "Simple Canva AI prompt (20-40 words, natural sentence style)"
}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2000,
      system: "You are a JSON API. Return only valid JSON, no markdown.",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "url", url: imageUrl },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<Omit<ImageToneAnalysis, "url">>(raw);
    return { ...parsed, url: imageUrl };
  } catch {
    // Image inaccessible or vision failed — skip silently
    return null;
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── サーバーサイド プラン・課金ガード（認証 + expired チェック） ──
  const guard = await requirePlanGuard(req);
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  // ── レートリミット ──
  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "analyze", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "analyze-images", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const {
      imageUrls,
      industry,
      serviceName,
    }: { imageUrls: string[]; industry: string; serviceName: string } =
      await req.json();

    if (!imageUrls?.length) {
      return NextResponse.json({ analyses: [] });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Analyse sequentially to avoid rate limits (max MAX_IMAGES)
    const targets = imageUrls.slice(0, MAX_IMAGES);
    const analyses: ImageToneAnalysis[] = [];

    for (const url of targets) {
      const result = await analyzeImage(client, url, industry || "一般業種", serviceName || "サービス");
      if (result) analyses.push(result);
    }

    return NextResponse.json({ analyses });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `画像分析に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
