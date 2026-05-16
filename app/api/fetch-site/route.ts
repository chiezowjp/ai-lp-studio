import { NextRequest, NextResponse } from "next/server";

// ─── Image URL extraction ─────────────────────────────────────────────────────

const SKIP_PATTERNS = [
  "favicon", "/icon", "logo", "1x1", "pixel", "tracking",
  "spacer", "blank", "arrow", "check", "bullet", "star",
];

function isContentImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (SKIP_PATTERNS.some((p) => lower.includes(p))) return false;
  if (lower.startsWith("data:")) return false;
  if (lower.endsWith(".svg") || lower.endsWith(".ico") || lower.endsWith(".gif")) return false;
  return true;
}

function extractImageUrls(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const urls: string[] = [];
  // <img src="...">
  const re = /<img[^>]+src=["']([^"'#?\s][^"']*?)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const src = m[1].trim();
    try {
      const abs = new URL(src, baseUrl).href;
      if (!seen.has(abs) && isContentImage(abs)) {
        seen.add(abs);
        urls.push(abs);
      }
    } catch {
      // ignore invalid URLs
    }
    if (urls.length >= 10) break;
  }
  return urls;
}

// ─── Text extraction helpers ──────────────────────────────────────────────────

function extractTitle(html: string): string {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : "";
}

function extractTextFromHtml(html: string): string {
  return html
    // Remove blocks we don't want
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<head[\s\S]*?<\/head>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    // Strip remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    // Collapse whitespace
    .replace(/\s+/g, " ")
    .trim();
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { url }: { url: string } = await req.json();

    // Validate URL
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return NextResponse.json(
        { error: "URLの形式が正しくありません。https:// から始まる完全なURLを入力してください。" },
        { status: 400 }
      );
    }

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return NextResponse.json(
        { error: "http / https のURLのみ対応しています。" },
        { status: 400 }
      );
    }

    // Fetch with 12-second timeout
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; LP-Generator-Bot/1.0; +https://lp-generator.vercel.app)",
          Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en;q=0.5",
        },
        redirect: "follow",
      });
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        return NextResponse.json(
          { error: "タイムアウト：サイトの応答が遅すぎます（12秒）。サイトが重いかダウンしている可能性があります。" },
          { status: 504 }
        );
      }
      return NextResponse.json(
        { error: `サイトに接続できません：${(err as Error).message}` },
        { status: 502 }
      );
    } finally {
      clearTimeout(timer);
    }

    // HTTP error handling
    if (response.status === 403 || response.status === 401) {
      return NextResponse.json(
        {
          error:
            "アクセスが拒否されました（" +
            response.status +
            "）。このサイトはボットアクセスをブロックしています。テキストを手動でコピーして「テキスト貼り付け」から解析してください。",
        },
        { status: 403 }
      );
    }
    if (response.status === 404) {
      return NextResponse.json(
        { error: "ページが見つかりません（404）。URLを確認してください。" },
        { status: 404 }
      );
    }
    if (response.status === 429) {
      return NextResponse.json(
        { error: "リクエスト制限に達しました（429）。しばらく時間をおいてお試しください。" },
        { status: 429 }
      );
    }
    if (!response.ok) {
      return NextResponse.json(
        { error: `サイトから ${response.status} エラーが返されました。` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("html")) {
      return NextResponse.json(
        { error: "HTMLページではないため取得できません（PDFや画像など）。" },
        { status: 415 }
      );
    }

    const html = await response.text();
    if (!html.trim()) {
      return NextResponse.json(
        { error: "サイトからコンテンツを取得できませんでした（空のレスポンス）。" },
        { status: 502 }
      );
    }

    const text = extractTextFromHtml(html);
    const title = extractTitle(html);
    const imageUrls = extractImageUrls(html, url);

    // Limit text to ~8000 chars so Claude doesn't time out
    return NextResponse.json({ text: text.slice(0, 8000), title, imageUrls });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json(
      { error: `取得に失敗しました: ${message}` },
      { status: 500 }
    );
  }
}
