import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SECTION_LABELS: Record<string, string> = {
  hero: "ファーストビュー（メインビジュアル）",
  service: "サービス紹介セクション",
  cta: "CTA（行動喚起）背景",
  testimonial: "お客様の声・実績セクション",
  gallery: "ギャラリー・実績写真",
};

const VALID_MIME_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ValidMimeType = (typeof VALID_MIME_TYPES)[number];

export async function POST(req: NextRequest) {
  try {
    const {
      imageBase64,
      mimeType,
      section,
      whatToReference,
      whatToChange,
      elementsToAdd,
      elementsToAvoid,
      serviceName,
      industry,
      serviceDetail,
      target,
    } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "画像データが必要です" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const sectionLabel = SECTION_LABELS[section as string] ?? section;

    const serviceLines = [
      serviceName && `・サービス名：${serviceName}`,
      industry && `・業種：${industry}`,
      serviceDetail && `・サービス内容：${serviceDetail}`,
      target && `・ターゲット：${target}`,
    ].filter(Boolean).join("\n");

    const memoLines = [
      whatToReference && `・参考にしたい点：${whatToReference}`,
      whatToChange && `・変えたい点：${whatToChange}`,
      elementsToAdd && `・入れたい要素：${elementsToAdd}`,
      elementsToAvoid && `・避けたい要素：${elementsToAvoid}`,
    ].filter(Boolean).join("\n");

    const prompt = `あなたはLPデザインのアートディレクターです。
添付した参考画像を詳しく観察し、ChatGPT（DALL-E 3）に「この参考画像を添付しながら」渡す画像生成指示文を日本語で作成してください。

【使用セクション】
${sectionLabel}

【サービス情報】
${serviceLines || "（未設定）"}

${memoLines ? `【ディレクションメモ】\n${memoLines}\n` : ""}
【指示文の必須条件 — すべて含めること】
1. 「添付画像を参考に、」という書き出しで始める
2. 参考画像の「雰囲気・印象」を具体的に言語化する（例：柔らかく温かみのある自然光の雰囲気）
3. 参考画像の「構図」の特徴を活かす（例：右側に余白を取った対角線構図）
4. 参考画像の「色味・カラートーン」を指定する（例：ベージュ・オフホワイト基調の淡いトーン）
5. 「余白を十分に確保し、テキストを重ねやすい構図」であることを明記する
6. LP（ランディングページ）用として「日本語テキストが読みやすい配置・明るさ」を指定する
7. ${serviceName ? `${serviceName}（${industry || ""}）` : "対象サービス"}のターゲットに合ったビジュアルにする${memoLines ? "\n8. ディレクションメモの内容を反映する" : ""}

指示文は200〜300文字の日本語で作成してください。
指示文のみを返してください（前置き・説明・見出し不要）。`;

    const safeMimeType: ValidMimeType = VALID_MIME_TYPES.includes(mimeType as ValidMimeType)
      ? (mimeType as ValidMimeType)
      : "image/jpeg";

    const response = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: safeMimeType,
                data: imageBase64,
              },
            },
            { type: "text", text: prompt },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const instruction = textBlock?.type === "text" ? textBlock.text.trim() : "";

    return NextResponse.json({ instruction });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `指示文の生成に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
