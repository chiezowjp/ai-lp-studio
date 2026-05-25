import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { ImagePromptConfig, ImagePromptResult, LPFormData } from "@/types";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { checkInputSize } from "@/lib/input-guard";
import { logRateLimitExceeded } from "@/lib/audit-logger";

// ─── AI ごとのプロンプト記法ガイド ──────────────────────────────────────────

const AI_FORMAT: Record<string, string> = {
  chatgpt: "ChatGPT (DALL-E 3)向け：自然な英文で詳細に記述。「A professional photo of...」形式。末尾にサイズ指定「1792x1024 pixels」を追加。",
  midjourney: "Midjourney v6向け：カンマ区切りの英語タグを使用。末尾に「--ar 16:9 --style raw --v 6 --q 2」などのパラメータを追加。ネガティブプロンプトは「--no text, watermark」形式。",
  canva: "Canva AI向け：短くシンプルな自然英文。複雑な記法は不要。「A bright, modern photo of...」形式で簡潔に記述。",
  gemini: "Gemini Imagen向け：詳細な自然英文。具体的な構図・光・スタイルを丁寧に説明。「Generate a photorealistic image...」形式。",
  leonardo: "Leonardo AI向け：Midjourneyに近いタグ形式。「photorealistic, ultra-detailed, ...」などの品質タグを先頭に。Model指定は PhotoReal v2推奨。",
  stablediffusion: "Stable Diffusion向け：カンマ区切りの英語タグ。品質タグ「masterpiece, best quality, highly detailed, 8k」を先頭に追加。ネガティブプロンプトも別途提示。",
  other: "汎用英語プロンプト：詳細な自然英文で構図・光・スタイルを説明。",
};

const AI_LABEL: Record<string, string> = {
  chatgpt: "ChatGPT (DALL-E 3)",
  midjourney: "Midjourney",
  canva: "Canva AI",
  gemini: "Gemini Imagen",
  leonardo: "Leonardo AI",
  stablediffusion: "Stable Diffusion",
  other: "汎用",
};

// ─── 使用場所ごとの LP 制約 ──────────────────────────────────────────────────

const PLACEMENT_CONSTRAINT: Record<string, string> = {
  hero: "LPの最上部ファーストビュー。大きな見出しテキストとCTAボタンが画像上に重なる。上部中央または左右に大きなテキスト用の余白スペースが必須。",
  service: "サービス紹介セクション。画像の左右にテキストが並ぶことが多い。横長で左右どちらかに余白があると使いやすい。",
  cta: "CTA（行動喚起）背景。「今すぐお申し込み」などのボタンとテキストが中央に重なる。全面的に文字が読める明るさと余白が必要。",
  testimonial: "お客様の声セクションの背景や顔写真。顔写真の場合は表情が伝わる自然な構図。背景の場合は控えめなデザイン。",
  background: "テキストの背後に敷く背景画像。テキストを邪魔しない薄め・シンプルなデザイン。コントラストを抑えること。",
  gallery: "ギャラリーの主役写真。テキスト不要。構図・被写体の美しさを最優先。",
  beforeafter: "ビフォーアフター比較画像。変化が明確に分かる統一感のある構図。左右またはスライダー形式で比較できるよう同一アングルで。",
  other: "LP内の各種用途。",
};

const MOOD_JA: Record<string, string> = {
  luxury: "高級感・プレミアム", natural: "ナチュラル・有機的", soft: "柔らかい・やさしい",
  simple: "シンプル・ミニマル", dark: "黒系・ダーク・重厚感", light: "白系・明るい・清潔感",
  feminine: "女性向け・エレガント", masculine: "男性向け・力強い", hotel: "高級ホテル風・洗練",
  korean: "韓国風・トレンド", nordic: "北欧風・ナチュラルモダン", modern: "モダン・都会的",
  japanese: "和風・日本的・和モダン",
};

const SIZE_LABEL: Record<string, string> = {
  landscape: "横長 16:9", portrait: "縦長 9:16", square: "正方形 1:1", mobile: "スマホ用縦長 9:16",
};

const BRIGHTNESS_LABEL: Record<string, string> = {
  bright: "明るめ（ハイキー）", dark: "暗め（ローキー）", natural: "自然光・ナチュラル", studio: "スタジオ照明・均一な明るさ",
};

// ─── Route handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── サーバーサイド プラン・課金ガード（認証 + expired チェック） ──
  const guard = await requirePlanGuard(req);
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  // ── レートリミット ──
  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "analyze", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "image-prompt", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  try {
    const { config, lpContext }: {
      config: ImagePromptConfig;
      lpContext?: Pick<LPFormData, "industry" | "serviceName" | "target" | "designMood">;
    } = await req.json();

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const peopleDesc = config.hasPeople
      ? [
          "人物あり",
          config.peopleAge && `年齢層：${config.peopleAge}`,
          config.peopleNationality === "japanese" ? "日本人" : config.peopleNationality === "foreign" ? "外国人" : config.peopleNationality === "both" ? "日本人・外国人混在" : null,
          config.peopleGender === "female" ? "女性" : config.peopleGender === "male" ? "男性" : config.peopleGender === "mixed" ? "男女" : null,
        ].filter(Boolean).join("、")
      : "人物なし";

    const prompt = `あなたはLP（ランディングページ）向け画像生成プロンプトの専門家です。
以下の設定から、LP制作に最適な高品質な画像生成プロンプトを作成してください。

【LP情報】${lpContext
  ? `\n業種：${lpContext.industry || "未設定"}\nサービス名：${lpContext.serviceName || "未設定"}\nターゲット：${lpContext.target || "未設定"}\nデザイン雰囲気：${lpContext.designMood || "未設定"}`
  : "\n情報なし"}

【画像設定】
- 使用AI：${AI_LABEL[config.aiTool] || config.aiTool}
- 使用場所：${PLACEMENT_CONSTRAINT[config.placement] || config.placement}
- 雰囲気：${config.moods.map((m) => MOOD_JA[m] || m).join("、") || "指定なし"}
- 人物：${peopleDesc}
- 背景イメージ：${config.backgroundDescription || "指定なし"}
- カラー：${config.colorPreference || "指定なし"}
- サイズ：${SIZE_LABEL[config.size]}
- 文字用余白：${config.needsTextSpace ? "必要（重要）" : "不要"}
- 明るさ：${BRIGHTNESS_LABEL[config.brightness]}

【LP向け絶対要件】
${config.needsTextSpace ? "1.【最重要】テキスト・見出しを載せるための余白を必ず確保。構図の30〜40%がぼんやりした空白エリアであること" : "1. 余白は不要だが構図のバランスを重視"}
2. 使用場所「${config.placement}」の特性を最大限考慮した構図
3. テキストと干渉しない適切な明るさ（特に明るすぎる白飛びを避ける）
4. スマホ表示でも見切れにくい中央寄りの安全な構図
5. ${lpContext?.designMood ? `「${lpContext.designMood}」というLPのデザイントーンと統一感のある雰囲気` : "プロフェッショナルなビジネス用途に適したデザイン"}

【出力指示】
3種類のプロンプトを生成してください：
1. japanese：日本語で詳細に説明（200字程度）。画像ディレクターへの指示書レベルで具体的に。
2. english：自然な英語プロンプト（100〜150語）。
3. optimized：${AI_FORMAT[config.aiTool]}

さらに tips として、この画像をLPで効果的に使うための具体的なデザインアドバイスを4点（日本語・短く）。

以下のJSONのみを返してください（前後に一切テキスト不要）：
{"japanese":"...","english":"...","optimized":"...","tips":["...","...","...","..."]}`;

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 2500,
      system: "You are a JSON API. Return only valid JSON with no extra text, no markdown.",
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";
    const parsed = extractAndParseJSON<ImagePromptResult>(raw);

    return NextResponse.json(parsed);
  } catch (err: unknown) {
    console.error("Image prompt error:", err);
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: `プロンプト生成に失敗しました: ${message}` }, { status: 500 });
  }
}
