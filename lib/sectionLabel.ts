/**
 * sectionLabel.ts
 *
 * セクション表示名の共通抽出ロジック。
 * app/page.tsx の parseSectionOrder・SectionSorter・SectionImageManager
 * すべてで同じ名前が出るよう、ここで一元管理する。
 *
 * 優先順位：
 *   1. h2 のテキスト
 *   2. h3 のテキスト
 *   3. 代表テキスト（最初の非空テキストノード, 最大 24 文字）
 *   4. SECTION_META の日本語名
 *   5. セクション ID そのまま
 */

/** page.tsx の SECTION_META と同じマップ（循環 import を避けるため複製） */
const SECTION_META: Record<string, string> = {
  hero:             "ファーストビュー",
  benefits:         "メリット",
  features:         "特徴",
  faq:              "よくある質問",
  cta:              "CTA",
  testimonials:     "お客様の声",
  price:            "料金",
  pricing:          "料金プラン",
  pricing_table:    "料金プラン",
  contact:          "お問い合わせ",
  about:            "会社概要",
  flow:             "ご利用の流れ",
  comparison:       "比較",
  results:          "実績",
  guarantee:        "保証",
  media:            "メディア掲載",
  staff:            "スタッフ紹介",
  access:           "アクセス",
  news:             "お知らせ",
};

/**
 * DOM 要素からセクション表示名を抽出する。
 *
 * @param el   - .lp-{id} クラスを持つセクション要素
 * @param id   - セクション ID（"hero", "program_overview" など）
 * @returns    人が読める表示名
 */
export function extractSectionLabel(el: Element, id: string): string {
  // 1. h2
  const h2 = el.querySelector("h2");
  if (h2) {
    const text = h2.textContent?.trim() ?? "";
    if (text) return truncate(text, 28);
  }

  // 2. h3
  const h3 = el.querySelector("h3");
  if (h3) {
    const text = h3.textContent?.trim() ?? "";
    if (text) return truncate(text, 28);
  }

  // 3. 最初の意味のあるテキストノード（button・script・style は除外）
  const SKIP = new Set(["SCRIPT", "STYLE", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "NAV"]);
  const candidate = firstMeaningfulText(el, SKIP);
  if (candidate) return truncate(candidate, 24);

  // 4. SECTION_META
  if (SECTION_META[id]) return SECTION_META[id];

  // 5. ID そのまま
  return id;
}

/** 再帰的に最初の意味のあるテキストを取得 */
function firstMeaningfulText(node: Element, skip: Set<string>): string {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent?.trim() ?? "";
      if (t.length >= 2) return t;
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (skip.has(el.tagName)) continue;
      const found = firstMeaningfulText(el, skip);
      if (found) return found;
    }
  }
  return "";
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max) + "…";
}
