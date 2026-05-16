"use client";

import { useMemo } from "react";
import { SEOItem } from "@/types";

function checkSEO(html: string): SEOItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");

  const items: SEOItem[] = [];

  // H1
  const h1s = doc.querySelectorAll("h1");
  items.push({
    label: "H1見出し",
    status: h1s.length === 1 ? "ok" : h1s.length === 0 ? "error" : "warn",
    value: h1s[0]?.textContent?.trim() || "未検出",
    suggestion:
      h1s.length === 0 ? "H1タグがありません。キャッチコピーをH1で囲みましょう"
      : h1s.length > 1 ? "H1は1ページ1つが推奨です"
      : undefined,
  });

  // 見出し構造
  const h2 = doc.querySelectorAll("h2").length;
  const h3 = doc.querySelectorAll("h3").length;
  items.push({
    label: "見出し構造",
    status: h2 >= 3 ? "ok" : h2 >= 1 ? "warn" : "error",
    value: `H1:${h1s.length}  H2:${h2}  H3:${h3}`,
    suggestion: h2 < 3 ? "各セクションにH2見出しを追加するとSEO効果が高まります" : undefined,
  });

  // 画像alt
  const imgs = doc.querySelectorAll("img");
  const missingAlts = Array.from(imgs).filter((img) => !img.getAttribute("alt")?.trim()).length;
  items.push({
    label: "画像のalt属性",
    status: imgs.length === 0 ? "warn" : missingAlts === 0 ? "ok" : "warn",
    value: imgs.length === 0 ? "画像なし" : `${imgs.length}枚中 ${imgs.length - missingAlts}枚設定済み`,
    suggestion:
      missingAlts > 0 ? `${missingAlts}枚にalt属性が未設定です。修正指示で追加を依頼してください` : undefined,
  });

  // CTA検出
  const ctaSelectors = [
    "a[class*='cta']", "button[class*='cta']",
    "a[href*='line']", "a[href^='tel']", "a[href*='contact']",
    ".lp-cta a", ".lp-cta button",
  ];
  let ctaEl: Element | null = null;
  for (const sel of ctaSelectors) {
    ctaEl = doc.querySelector(sel);
    if (ctaEl) break;
  }
  const ctaText = ctaEl?.textContent?.trim() || "";
  items.push({
    label: "CTA文言",
    status: ctaEl ? "ok" : "warn",
    value: ctaText || "未検出",
    suggestion:
      !ctaEl ? "CTAボタンが検出できませんでした"
      : ctaText.length < 5 ? "CTA文言が短すぎます。具体的な行動を促す文にしましょう"
      : undefined,
  });

  // WordPress側で設定が必要なもの
  items.push({
    label: "titleタグ",
    status: "warn",
    value: "WordPress側で設定",
    suggestion: "SEOプラグイン（Yoast SEO等）または「ページ」設定でタイトルを入力してください",
  });
  items.push({
    label: "meta description",
    status: "warn",
    value: "WordPress側で設定",
    suggestion: "SEOプラグインで120〜160文字のmeta descriptionを設定してください",
  });

  return items;
}

const STYLE: Record<SEOItem["status"], string> = {
  ok: "border-green-200 bg-green-50 text-green-800",
  warn: "border-amber-200 bg-amber-50 text-amber-800",
  error: "border-red-200 bg-red-50 text-red-800",
};
const ICON: Record<SEOItem["status"], string> = { ok: "✓", warn: "!", error: "✕" };

export default function SEOChecker({ html }: { html: string }) {
  const items = useMemo(() => checkSEO(html), [html]);
  const okCount = items.filter((i) => i.status === "ok").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">SEOチェック</h3>
        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
          {okCount} / {items.length} OK
        </span>
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className={`rounded-lg border px-3 py-2 text-xs ${STYLE[item.status]}`}>
            <div className="flex items-center gap-1.5">
              <span className="font-bold w-3 shrink-0">{ICON[item.status]}</span>
              <span className="font-semibold">{item.label}</span>
              <span className="ml-auto opacity-70 truncate max-w-[160px]">{item.value}</span>
            </div>
            {item.suggestion && (
              <p className="mt-1 ml-4.5 opacity-80 leading-relaxed">{item.suggestion}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
