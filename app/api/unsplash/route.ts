import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { extractAndParseJSON } from "@/lib/parseAIJson";
import { UnsplashPhoto, UnsplashResult } from "@/types";

interface Keywords {
  hero: string;
  service: string;
  background: string;
}

async function generateKeywords(
  industry: string,
  target: string,
  serviceDetail: string
): Promise<Keywords> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 300,
    system: "You are a JSON API. Return only valid JSON with no extra text.",
    messages: [
      {
        role: "user",
        content: `Generate concise English Unsplash search keywords for a Japanese business landing page.

Business info:
- Industry (業種): ${industry}
- Target audience (ターゲット): ${target}
- Service (サービス内容): ${serviceDetail}

Rules:
- Each keyword must be 2-4 English words, optimized for finding professional stock photos on Unsplash
- "hero": main visual that represents the business/service emotion
- "service": photo showing the service being delivered or its result
- "background": subtle abstract or texture background suitable for a section backdrop

Return ONLY this JSON:
{"hero":"keyword here","service":"keyword here","background":"keyword here"}`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock?.type === "text" ? textBlock.text : "";
  return extractAndParseJSON<Keywords>(raw);
}

async function fetchUnsplashPhotos(keyword: string, perPage = 6): Promise<UnsplashPhoto[]> {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) return [];

  try {
    const url = `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=${perPage}&orientation=landscape&content_filter=high`;
    const res = await fetch(url, {
      headers: { Authorization: `Client-ID ${accessKey}` },
      next: { revalidate: 3600 }, // 1時間キャッシュ
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []) as UnsplashPhoto[];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { industry, target, serviceDetail } = await req.json();

    if (!industry || !serviceDetail) {
      return NextResponse.json({ error: "industry と serviceDetail は必須です" }, { status: 400 });
    }

    // 1. Claude でキーワード生成
    const keywords = await generateKeywords(industry, target || "", serviceDetail);

    // 2. 検索リンク（API キーがなくても使える）
    const searchLinks = {
      hero: `https://unsplash.com/s/photos/${encodeURIComponent(keywords.hero)}`,
      service: `https://unsplash.com/s/photos/${encodeURIComponent(keywords.service)}`,
      background: `https://unsplash.com/s/photos/${encodeURIComponent(keywords.background)}`,
    };

    const hasApiKey = !!process.env.UNSPLASH_ACCESS_KEY;

    // 3. API キーがある場合は画像を取得
    let categories: UnsplashResult["categories"] = [
      { id: "hero", label: "ファーストビュー", keyword: keywords.hero, photos: [] },
      { id: "service", label: "サービス紹介", keyword: keywords.service, photos: [] },
      { id: "background", label: "背景", keyword: keywords.background, photos: [] },
    ];

    if (hasApiKey) {
      const [heroPhotos, servicePhotos, bgPhotos] = await Promise.all([
        fetchUnsplashPhotos(keywords.hero),
        fetchUnsplashPhotos(keywords.service),
        fetchUnsplashPhotos(keywords.background),
      ]);
      categories = [
        { id: "hero", label: "ファーストビュー", keyword: keywords.hero, photos: heroPhotos },
        { id: "service", label: "サービス紹介", keyword: keywords.service, photos: servicePhotos },
        { id: "background", label: "背景", keyword: keywords.background, photos: bgPhotos },
      ];
    }

    const result: UnsplashResult = { hasApiKey, keywords, searchLinks, categories };
    return NextResponse.json(result);
  } catch (err: unknown) {
    console.error("Unsplash route error:", err);
    const message = err instanceof Error ? err.message : "不明なエラー";
    return NextResponse.json({ error: `画像検索に失敗しました: ${message}` }, { status: 500 });
  }
}
