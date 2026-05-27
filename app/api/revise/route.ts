import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requirePlanGuard } from "@/lib/plan-guard";
import { checkRateLimitBoth, getClientIp } from "@/lib/rate-limiter";
import { checkInputSize, checkContentLength } from "@/lib/input-guard";
import { logRateLimitExceeded } from "@/lib/audit-logger";

// Vercel Pro では最大 300 秒まで許容（LP が大きいと生成に時間がかかるため）
export const maxDuration = 300;

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

  let body: { html: string; css: string; instruction: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "リクエストの解析に失敗しました" }, { status: 400 });
  }

  const { html, css, instruction } = body;

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

  // ── ストリーミングレスポンス（Vercel タイムアウト回避）──
  // client.messages.create() はブロッキングのため大きな LP では 60 秒を超えてタイムアウトする。
  // ReadableStream で Anthropic のストリームをそのままクライアントへ流すことで
  // 「接続が生きている間は応答を受け取り続ける」構造に変える。
  const encoder = new TextEncoder();

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const stream = client.messages.stream({
          model: "claude-opus-4-7",
          max_tokens: 16000,
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
        // エラーはストリーム末尾に埋め込んでクライアント側で検出する
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
