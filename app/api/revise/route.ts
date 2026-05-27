import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { checkInputSize, checkContentLength } from "@/lib/input-guard";
import { logRateLimitExceeded } from "@/lib/audit-logger";

export const maxDuration = 300;

// CSS のみの変更（色・サイズ・背景等）は差分 CSS だけ返させる。
// HTML 構造変更・テキスト変更が必要な場合のみ HTML 全体も返す。
// これにより出力が 100〜500 トークン程度になり高速化・安定化する。
const SYSTEM_PROMPT = `あなたはLPのHTML/CSS編集アシスタントです。
修正指示を分析して、必要最小限の出力をしてください。

【CSSの変更がある場合（色・背景・サイズ・フォント・枠等）】
===CSS_PATCH_START===
（変更・追加するCSSルールのみ出力。既存CSSの末尾に追記されます）
===CSS_PATCH_END===

【HTMLの変更がある場合（テキスト変更・要素の追加削除・構造変更）】
===HTML_START===
（修正後のHTML全体を出力）
===HTML_END===

ルール：
- CSSのみの変更（色・背景・枠・サイズ等）はCSS_PATCHのみ出力し、HTMLは出力しない
- テキストやHTML構造の変更がある場合はHTML_STARTも出力する
- 変更のない方は出力しない
- CSSクラス名の "lp-" プレフィックスは維持する
- CSS_PATCHは末尾追記で上書きされるため、変更したいプロパティを含む完全なルールを書く`;

export async function POST(req: NextRequest) {
  const clCheck = checkContentLength(req);
  if (clCheck) return clCheck;

  const guard = await requirePlanGuard(req, { checkUsage: "ai_edit" });
  if (guard instanceof NextResponse) return guard;
  const { user, planType } = guard;

  const ip = getClientIp(req);
  const rl = checkRateLimitBoth(ip, user.id, "ai_edit", planType);
  if (!rl.allowed) {
    logRateLimitExceeded({ userId: user.id, ip, action: "ai_edit", count: rl.count, limit: rl.limit });
    return NextResponse.json(
      { error: "リクエストが多すぎます。しばらく待ってから再試行してください。", retry_after: rl.retryAfter },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }

  let body: { html: string; css: string; instruction: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const { html, css, instruction } = body;

  const sizeCheck = checkInputSize(body as Record<string, unknown>, { hasHtml: true });
  if (sizeCheck) return sizeCheck;

  if (!html || !css || !instruction?.trim()) {
    return NextResponse.json({ error: "html, css, instruction は必須です" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `【修正指示】
${instruction}

【現在のHTML】
${html}

【現在のCSS】
${css}`;

  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 32000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });

        for await (const chunk of stream) {
          if (
            chunk.type === "content_block_delta" &&
            chunk.delta.type === "text_delta"
          ) {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }
        controller.close();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "不明なエラー";
        controller.enqueue(
          encoder.encode(`\n===REVISE_ERROR===\n${msg}\n===REVISE_ERROR_END===`)
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
