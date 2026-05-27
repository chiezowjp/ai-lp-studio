/**
 * sectionLabel.ts
 *
 * セクション表示名の共通抽出ロジック。
 * app/page.tsx の parseSectionOrder・SectionSorter・SectionImageManager
 * すべてで同じ名前が出るよう、ここで一元管理する。
 *
 * 優先順位：
 *   0. h1 のテキスト（ヒーローセクション向け）
 *   1. h2 のテキスト（lp-* ネスト要素内は除外）
 *   2. h3 のテキスト（同上）
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
  // 0. h1（ヒーローセクションは h1 をメイン見出しとして使うことが多い）
  //    h2 より先に参照することで、h1 を持つセクションが正しくラベル付けされる
  const h1 = el.querySelector("h1");
  if (h1) {
    const text = h1.textContent?.trim() ?? "";
    if (text) return truncate(text, 28);
  }

  // 1. h2（lp-* クラスを持つネスト要素の内側にある h2 は除外して誤ラベルを防ぐ）
  const h2 = findTopHeading(el, "h2");
  if (h2) return truncate(h2, 28);

  // 2. h3（同様に lp-* ネスト内を除外）
  const h3 = findTopHeading(el, "h3");
  if (h3) return truncate(h3, 28);

  // 3. 最初の意味のあるテキストノード（button・script・style は除外）
  const SKIP = new Set(["SCRIPT", "STYLE", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "NAV"]);
  const candidate = firstMeaningfulText(el, SKIP);
  if (candidate) return truncate(candidate, 24);

  // 4. SECTION_META
  if (SECTION_META[id]) return SECTION_META[id];

  // 5. ID そのまま
  return id;
}

/**
 * セクション要素 `el` 内の `tag`（"h2" / "h3"）を探すが、
 * 別の lp-* セクション要素にネストされている見出しはスキップする。
 * これにより、1つのセクション内に別セクションのタイトルが埋め込まれていても
 * 誤ったラベルを付けてしまう問題を防ぐ。
 */
function findTopHeading(el: Element, tag: string): string {
  const headings = Array.from(el.querySelectorAll(tag));
  for (const h of headings) {
    // el から h までの祖先を辿り、「セクション級 lp-*」クラスを持つ別要素が
    // 途中にあればスキップする。
    // セクション級 = parseSectionOrder と同じ正規表現 ^lp-[a-z][a-z0-9_]*$
    //（lp-hero・lp-problem 等は該当。lp-hero-inner・lp-hero-btn 等 BEM サブ要素は非該当）
    let ancestor = h.parentElement;
    let isNested = false;
    while (ancestor && ancestor !== el) {
      if (Array.from(ancestor.classList).some((c) => /^lp-[a-z][a-z0-9_]*$/.test(c))) {
        isNested = true;
        break;
      }
      ancestor = ancestor.parentElement;
    }
    if (!isNested) {
      const text = h.textContent?.trim() ?? "";
      if (text) return text;
    }
  }
  return "";
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
