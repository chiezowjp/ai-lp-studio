/**
 * lib/input-guard.ts — AI リクエスト 入力サイズバリデーション
 *
 * AI API Route で呼び出し、過大なペイロードを拒否する。
 * DoS / 課金爆撃対策。
 *
 * ─── 上限仕様 ──────────────────────────────────────────────────────────────
 *   リクエストボディ全体:  20 KB
 *   HTML フィールド単体:  500 KB
 *   Base64 画像単体:      10 MB（≒ 元画像 ~7.5 MB）
 *   画像枚数:              5 枚
 */

import { NextResponse } from "next/server";

const MAX_BODY_BYTES   = 20  * 1024;        // 20 KB
const MAX_HTML_BYTES   = 500 * 1024;        // 500 KB
const MAX_IMAGE_BYTES  = 10  * 1024 * 1024; // 10 MB (base64 encoded)
const MAX_IMAGE_COUNT  = 5;

export interface InputGuardOptions {
  /** HTML フィールドの最大バイト数（デフォルト 500 KB） */
  maxHtmlBytes?: number;
  /** リクエストボディ全体の最大バイト数（デフォルト 20 KB） */
  maxBodyBytes?: number;
  /** HTML フィールドが含まれるかチェックするか（デフォルト false） */
  hasHtml?: boolean;
  /** 画像 base64 チェックするか（デフォルト false） */
  hasImages?: boolean;
}

/**
 * リクエストボディのサイズをチェックする。
 *
 * body は req.json() で取得済みのオブジェクト、
 * rawSize は Content-Length ヘッダー値（あれば）。
 *
 * @returns NextResponse（拒否） or null（通過）
 */
export function checkInputSize(
  body: Record<string, unknown>,
  opts: InputGuardOptions = {},
): NextResponse | null {
  const maxBody  = opts.maxBodyBytes ?? MAX_BODY_BYTES;
  const maxHtml  = opts.maxHtmlBytes ?? MAX_HTML_BYTES;

  // ── ボディ全体サイズ ──────────────────────────────────────────────────────
  const bodyStr  = JSON.stringify(body);
  const bodySize = Buffer.byteLength(bodyStr, "utf8");

  // HTML チェックは別途行うため、ボディの上限は HTML 除外後のサイズで判定する
  // （HTML フィールドは HTML 専用上限で別チェック）
  const bodyWithoutHtml = opts.hasHtml ? (() => {
    const clone = { ...body };
    delete clone.html;
    delete clone.css;
    return JSON.stringify(clone);
  })() : bodyStr;

  const effectiveBodySize = Buffer.byteLength(bodyWithoutHtml, "utf8");

  if (effectiveBodySize > maxBody) {
    return NextResponse.json(
      {
        error: `リクエストが大きすぎます（上限 ${Math.round(maxBody / 1024)} KB）。`,
        code:  "INPUT_TOO_LARGE",
      },
      { status: 413 },
    );
  }

  // ── HTML / CSS フィールドチェック ─────────────────────────────────────────
  if (opts.hasHtml) {
    const htmlStr = typeof body.html === "string" ? body.html : "";
    const cssStr  = typeof body.css  === "string" ? body.css  : "";
    const htmlSize = Buffer.byteLength(htmlStr + cssStr, "utf8");
    if (htmlSize > maxHtml) {
      return NextResponse.json(
        {
          error: `HTML/CSS が大きすぎます（上限 ${Math.round(maxHtml / 1024)} KB）。`,
          code:  "INPUT_TOO_LARGE",
        },
        { status: 413 },
      );
    }
  }

  // ── 画像 base64 チェック ──────────────────────────────────────────────────
  if (opts.hasImages) {
    // 単一画像（imageBase64 フィールド）
    if (body.imageBase64 && typeof body.imageBase64 === "string") {
      const imageSize = Buffer.byteLength(body.imageBase64, "utf8");
      if (imageSize > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: `画像が大きすぎます（上限 ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB）。`, code: "INPUT_TOO_LARGE" },
          { status: 413 },
        );
      }
    }

    // 複数画像（imageUrls フィールド — URL なのでカウントのみ）
    if (Array.isArray(body.imageUrls)) {
      if (body.imageUrls.length > MAX_IMAGE_COUNT) {
        return NextResponse.json(
          { error: `画像は最大 ${MAX_IMAGE_COUNT} 枚まで処理できます。`, code: "INPUT_TOO_LARGE" },
          { status: 413 },
        );
      }
    }

    // 複数画像（images 配列）
    if (Array.isArray(body.images)) {
      if (body.images.length > MAX_IMAGE_COUNT) {
        return NextResponse.json(
          { error: `画像は最大 ${MAX_IMAGE_COUNT} 枚まで処理できます。`, code: "INPUT_TOO_LARGE" },
          { status: 413 },
        );
      }
    }
  }

  return null; // 通過
}

/**
 * Content-Length ヘッダーから早期に過大リクエストを拒否するヘルパー。
 * body 読み込み前に呼ぶことで、大きなボディを読み込むコストを避ける。
 *
 * @param req        NextRequest
 * @param maxBytes   最大バイト数（デフォルト 20 MB — Content-Length 全体上限）
 */
export function checkContentLength(
  req: Request,
  maxBytes: number = 20 * 1024 * 1024,
): NextResponse | null {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > maxBytes) {
      return NextResponse.json(
        { error: "リクエストボディが大きすぎます。", code: "INPUT_TOO_LARGE" },
        { status: 413 },
      );
    }
  }
  return null;
}
