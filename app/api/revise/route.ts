import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";

const SYSTEM_PROMPT = `あなたはJSON APIです。
ユーザーの指示に従い、必ず有効なJSONオブジェクトのみを返してください。
以下のルールを厳守してください：
- レスポンスは必ず { で始まり } で終わること
- JSONの前後に説明文・コメント・Markdownコードブロック（\`\`\`）を絶対に含めないこと
- JSON内の文字列値でダブルクォーテーション（"）を使う場合は必ず \\\" にエスケープすること
- JSON内の文字列値で改行を含める場合は \\n を使用すること
- 出力はJSONパーサーで直接パースできる形式のみとすること`;

export async function POST(req: NextRequest) {
  try {
    const { html, css, instruction } = await req.json();

    if (!html || !css || !instruction?.trim()) {
      return NextResponse.json({ error: "html, css, instruction は必須です" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `以下の既存LP（HTML+CSS）に対して、【修正指示】に従って編集してください。
修正指示に含まれない部分は変更しないでください。CSSクラス名の "lp-" プレフィックスは維持してください。

【修正指示】
${instruction}

【現在のHTML】
${html}

【現在のCSS】
${css}

【厳守事項】
あなたのレスポンス全体が以下のJSONオブジェクトそのものでなければなりません。
前後に一切のテキストを付けないでください。

{"html":"（修正後のHTMLコード）","css":"（修正後のCSSコード）"}`;

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = extractAndParseJSON<{ html: string; css: string }>(raw);

    if (!parsed.html || !parsed.css) {
      throw new Error("AI出力の整形に失敗しました。再生成してください。");
    }

    return NextResponse.json({ html: parsed.html, css: parsed.css });
  } catch (err: unknown) {
    console.error("LP修正エラー:", err);
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: `LP修正に失敗しました: ${message}` }, { status: 500 });
  }
}
