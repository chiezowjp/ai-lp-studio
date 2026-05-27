import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { checkInputSize, checkContentLength } from "@/lib/input-guard";
import { logRateLimitExceeded } from "@/lib/audit-logger";

const SYSTEM_PROMPT = `あなたはLPのHTML/CSSを編集するアシスタントです。
ユーザーの修正指示に従い、以下の形式で必ず出力してください。

===HTML_START===
（修正後のHTMLをここに出力）
===HTML_END===
===CSS_START===
（修正後のCSSをここに出力）
===CSS_END===

ルール：
- 上記の区切り文字は必ず正確に使うこと
- 区切り文字の外に説明文を書かないこと
- 修正指示に含まれない部分は変更しないこと
- CSSクラス名の "lp-" プレフィックスは維持すること`;

/** 区切り文字形式のレスポンスからHTMLとCSSを抽出する */
function parseDelimitedResponse(raw: string): { html: string; css: string } | null {
  const htmlMatch = raw.match(/===HTML_START===\s*([\s\S]*?)\s*===HTML_END===/);
  const cssMatch  = raw.match(/===CSS_START===\s*([\s\S]*?)\s*===CSS_END===/);

  if (!htmlMatch?.[1] || !cssMatch?.[1]) return null;

  return {
    html: htmlMatch[1].trim(),
    css:  cssMatch[1].trim(),
  };
}

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
    const body = await req.json();
    const { html, css, instruction } = body as { html: string; css: string; instruction: string };

    // ── 入力サイズ検証 ──
    const sizeCheck = checkInputSize(body as Record<string, unknown>, { hasHtml: true });
    if (sizeCheck) return sizeCheck;

    if (!html || !css || !instruction?.trim()) {
      return NextResponse.json({ error: "html, css, instruction は必須です" }, { status: 400 });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const prompt = `以下の既存LP（HTML+CSS）に対して、【修正指示】に従って編集してください。

【修正指示】
${instruction}

【現在のHTML】
${html}

【現在のCSS】
${css}`;

    const response = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const raw = textBlock?.type === "text" ? textBlock.text : "";

    const parsed = parseDelimitedResponse(raw);

    if (!parsed?.html || !parsed?.css) {
      throw new Error("AI出力の解析に失敗しました。");
    }

    return NextResponse.json({ html: parsed.html, css: parsed.css });
  } catch (err: unknown) {
    console.error("LP修正エラー:", err);
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: `LP修正に失敗しました: ${message}` }, { status: 500 });
  }
}
