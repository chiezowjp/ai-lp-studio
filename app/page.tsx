"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import LPForm from "@/components/LPForm";
import LPPreview, { LPPreviewHandle, ButtonImageOverride } from "@/components/LPPreview";
import CodeBlock from "@/components/CodeBlock";
import RevisionForm from "@/components/RevisionForm";
import SEOChecker from "@/components/SEOChecker";
import ColorThemePicker from "@/components/ColorThemePicker";
import SectionSorter, { SortableSection } from "@/components/SectionSorter";
import AddSectionModal from "@/components/AddSectionModal";
import ImagePromptAssistant from "@/components/ImagePromptAssistant";
import SiteImporter from "@/components/SiteImporter";
import VisualStylePanel from "@/components/VisualStylePanel";
import LPRefAnalyzer from "@/components/LPRefAnalyzer";
import SectionImageManager from "@/components/SectionImageManager";
import ImageInsertPanel from "@/components/ImageInsertPanel";
import FreeBlockPanel from "@/components/FreeBlockPanel";
import CustomHtmlPanel from "@/components/CustomHtmlPanel";
import { LPFormData, GeneratedLP, UploadedImage, PreviewMode, UnsplashResult, SavedImagePrompt, SelectedElement, VisualStyles, StyleRule, LPAnalysis } from "@/types";
import type { ProblemLayout } from "@/components/LPRefAnalyzer";
import { SECTION_TEMPLATES } from "@/lib/sectionTemplates";
import { buildVisualCss } from "@/lib/visualStyles";
import { extractSectionLabel } from "@/lib/sectionLabel";
import { FONT_OPTIONS, DEFAULT_FONT_ID, buildFontCss, getFontGoogleUrl, getFontOption } from "@/lib/fonts";
import {
  LPProject, ProjectSnapshot,
  buildProject, saveToLocal, loadFromLocal, clearLocal,
  downloadProject, parseProjectFile, formatSavedAt,
  serializeImages, serializeImagesSync, deserializeImages,
} from "@/lib/project";
import { useAuth } from "@/lib/auth-context";
import { usePlan } from "@/lib/plan-context";
import { isLimitReached, PLAN_LIMITS } from "@/lib/plans";
import PlanBadge from "@/components/PlanBadge";
import UpgradeModal from "@/components/UpgradeModal";
import LockScreen from "@/components/LockScreen";
import PublishPanel from "@/components/PublishPanel";
import FormConfigPanel from "@/components/FormConfigPanel";
import Tooltip from "@/components/Tooltip";
import GalleryModal from "@/components/GalleryModal";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultTab = "preview" | "html" | "css";
type InputMethod = "form" | "url" | "text" | "ref";
type EditMode = "text" | "style" | "image";

/** Undo スナップショット — HTML・セクション順・スタイル・フォント・画像をまとめて保存 */
type UndoSnapshot = {
  html: string;
  sectionOrder: SortableSection[];
  visualStyles: VisualStyles;
  globalFont: string;
  images: UploadedImage[];
};

// ─── Constants ───────────────────────────────────────────────────────────────

const RETRY_DELAYS = [2000, 5000, 10000];

const SECTION_META: Record<string, string> = {
  // AI生成セクション
  hero: "ファーストビュー",
  problem: "お悩み",
  reason: "選ばれる理由",
  service: "サービス内容",
  price: "料金",
  testimonial: "お客様の声",
  faq: "FAQ",
  cta: "CTA",
  // 追加セクション
  ...Object.fromEntries(SECTION_TEMPLATES.map((t) => [t.id, t.label])),
};

// ─── Utilities ───────────────────────────────────────────────────────────────

async function generateWithRetry(
  data: LPFormData,
  onRetry: (message: string) => void,
  accessToken?: string,
): Promise<GeneratedLP> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (res.ok) return json as GeneratedLP;
    const isOverloaded = json.type === "overloaded";
    if (isOverloaded && attempt < RETRY_DELAYS.length) {
      const delaySec = RETRY_DELAYS[attempt] / 1000;
      onRetry(`現在AIが混み合っています。${delaySec}秒後に自動で再試行します… (${attempt + 1}/${RETRY_DELAYS.length})`);
      await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
      continue;
    }
    throw new Error(
      isOverloaded
        ? "現在AIが大変混み合っています。しばらく時間をおいてから再試行してください。"
        : json.error ?? "生成に失敗しました"
    );
  }
  throw new Error("生成に失敗しました");
}

/**
 * セレクター（例: ".lp-hero"）に対する背景色を CSS テキストから直接抽出する。
 * iframe から受け取った computedStyles.backgroundColor が transparent/白の場合のフォールバックとして使用。
 * background-color（solid）・background shorthand（gradient 含む）の両方に対応。
 */
function extractBgFromSelector(selector: string, css: string, lpClasses?: string[]): string {
  // 検索対象の lp-* クラス名リストを決定
  // lpClasses が渡された場合はそれを優先（[data-element-id=...] セレクターでも正しく動作する）
  let classesToSearch: string[];
  if (lpClasses && lpClasses.length > 0) {
    classesToSearch = lpClasses.filter(c => c.startsWith("lp-") && !c.startsWith("lp-vs"));
  } else {
    const lpClass = selector.replace(/^\./, ""); // ".lp-hero" → "lp-hero"
    // [data-element-id="..."] 等の非クラスセレクターは正規表現に使えないため早期リターン
    if (!lpClass.startsWith("lp-") || /[[\]"'=]/.test(lpClass)) return "";
    classesToSearch = [lpClass];
  }
  if (!classesToSearch.length) return "";

  const isClear = (v: string) =>
    !v || v === "transparent" || /^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(v.trim());
  const firstColor = (v: string) => {
    const m = v.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b/);
    return m ? m[0] : "";
  };
  let found = "";
  let bestPos = -1;
  for (const lpClass of classesToSearch) {
    const re = new RegExp(`(?:^|[^\\w-])(\\.${lpClass})\\s*\\{([^}]+)\\}`, "gm");
    let match: RegExpExecArray | null;
    while ((match = re.exec(css)) !== null) {
      const pos = match.index;
      const block = match[2];
      let blockFound = "";
      const m1 = block.match(/background-color\s*:\s*([^;!}\n]+)/);
      if (m1) { const v = m1[1].trim(); if (!isClear(v) && v !== "initial" && v !== "inherit") blockFound = v; }
      const m2 = block.match(/(?<![a-z-])background\s*:\s*([^;!}\n]+)/);
      if (m2) { const c = firstColor(m2[1].trim()); if (c && !isClear(c)) blockFound = c; }
      if (blockFound && pos > bestPos) { found = blockFound; bestPos = pos; }
    }
  }
  return found;
}

/**
 * placement が "other" の場合は汎用ラッパー、それ以外は `.lp-wrapper > :nth-child(N)` を使用。
 *
 * `.lp-{placement}` クラスセレクタではなく nth-child 位置セレクタを使う理由:
 * AI が生成した HTML でまれに複数要素が同じ lp-* クラスを持つ場合があり、
 * クラスセレクタだと意図しない別セクションにも画像が当たってしまう。
 * 位置セレクタは .lp-wrapper の直下の何番目かで一意に特定するため衝突が起きない。
 *
 * data-bubble-layout="1" 付きセクションは背景画像を contain/center で表示
 * （人物画像を大きく中央表示させるため）。
 */
function buildImageCss(images: UploadedImage[], html: string = ""): string {
  // HTML からセクション位置マップ（placement id → 1-based nth-child index）と
  // 吹き出しセクション ID を同時に検出
  const positionMap = new Map<string, number>();
  const bubbleIds = new Set<string>();

  if (typeof window !== "undefined" && html) {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const wrapper = doc.querySelector(".lp-wrapper") ?? doc.body;
      const sectionClass = /^lp-([a-z][a-z0-9_]*)$/;
      const seen = new Set<string>();
      let childIndex = 1; // nth-child は 1 始まり
      for (const child of Array.from(wrapper.children)) {
        for (const cls of Array.from(child.classList)) {
          const m = cls.match(sectionClass);
          if (m && !seen.has(m[1])) {
            seen.add(m[1]);
            positionMap.set(m[1], childIndex);
            break;
          }
        }
        childIndex++;
      }
      // 吹き出しセクション ID を検出
      doc.querySelectorAll("[data-bubble-layout]").forEach((el) => {
        for (const cls of Array.from(el.classList)) {
          const m = cls.match(/^lp-([a-z0-9-]+)$/);
          if (m) { bubbleIds.add(m[1]); break; }
        }
      });
    } catch { /* ignore */ }
  }

  return images
    .map((img) => {
      let sel: string;
      if (img.placement === "other") {
        sel = ".lp-wrapper";
      } else {
        const pos = positionMap.get(img.placement);
        // 位置が分かればピンポイント nth-child、分からなければクラス名にフォールバック
        sel = pos !== undefined
          ? `.lp-wrapper > :nth-child(${pos})`
          : `.lp-${img.placement}`;
      }
      if (img.placement !== "other" && bubbleIds.has(img.placement)) {
        // 吹き出しセクション：人物画像を背景に contain で表示
        return `${sel} { background-image: url("${img.url}") !important; background-size: contain !important; background-position: center !important; background-repeat: no-repeat !important; }`;
      }
      return `${sel} { background-image: url("${img.url}") !important; background-size: cover !important; background-position: center !important; }`;
    })
    .join("\n");
}

/** CSSから頻度上位の #xxxxxx カラーを抽出 */
function extractTopColors(css: string, limit = 6): string[] {
  const freq = new Map<string, number>();
  const re = /#[0-9a-f]{6}\b/gi;
  let m;
  while ((m = re.exec(css)) !== null) {
    const c = m[0].toLowerCase();
    freq.set(c, (freq.get(c) || 0) + 1);
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([c]) => c);
}

/** 色の全置換 */
function replaceColors(css: string, replacements: Record<string, string>): string {
  let result = css;
  for (const [from, to] of Object.entries(replacements)) {
    if (from !== to) result = result.split(from).join(to);
  }
  return result;
}

/** HTML からセクション順を検出（DOM全スキャン — ホワイトリスト不要）
 *  .lp-wrapper の直下、なければ body の直下を走査し
 *  "lp-{id}" クラスを持つ要素を出現順に返す。
 *  ラベルは extractSectionLabel() で h2 → h3 → 代表テキスト → SECTION_META → ID の順に解決する。
 */
function parseSectionOrder(html: string): SortableSection[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const wrapper = doc.querySelector(".lp-wrapper") ?? doc.body;
  const result: SortableSection[] = [];
  const seen = new Set<string>();
  // lp-{id} の形式（ハイフン・アンダースコア以外に追加のハイフンを含まない）
  const sectionClass = /^lp-([a-z][a-z0-9_]*)$/;
  for (const child of Array.from(wrapper.children)) {
    for (const cls of Array.from(child.classList)) {
      const m = cls.match(sectionClass);
      if (m && !seen.has(m[1])) {
        const id = m[1];
        seen.add(id);
        // h2 → h3 → 代表テキスト → SECTION_META → ID の順で表示名を解決
        result.push({ id, label: extractSectionLabel(child, id) });
        break; // 1要素につき最初の lp-* クラスだけを ID として採用（reorderHtmlSections と一致）
      }
    }
  }
  return result;
}

/** セクション並び替え後の HTML を再構築（DOM全スキャン — ホワイトリスト不要）
 *  parseSectionOrder と同じロジックで wrapper 直下の lp-* 要素を取得し、
 *  newOrder の順に並べ直す。SECTION_META 外のセクション（追加テンプレート・参考LP由来）も正しく処理する。
 */
function reorderHtmlSections(html: string, newOrder: string[]): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const wrapper = doc.querySelector(".lp-wrapper") ?? doc.body;
  const sectionClass = /^lp-([a-z][a-z0-9_]*)$/;

  // wrapper 直下の子要素からセクション要素を収集（出現順マップ）
  const sectionEls = new Map<string, Element>();
  for (const child of Array.from(wrapper.children)) {
    for (const cls of Array.from(child.classList)) {
      const m = cls.match(sectionClass);
      if (m && !sectionEls.has(m[1])) {
        sectionEls.set(m[1], child);
        break;
      }
    }
  }

  if (sectionEls.size === 0) return html;

  // セクション以外の before / after 要素を分離
  const sectionSet = new Set(sectionEls.values());
  const before: Element[] = [];
  const after: Element[] = [];
  let passedSections = false;
  for (const child of Array.from(wrapper.children)) {
    if (sectionSet.has(child)) { passedSections = true; continue; }
    if (!passedSections) before.push(child);
    else after.push(child);
  }

  // 全子要素を取り除いてから再挿入
  while (wrapper.firstChild) wrapper.removeChild(wrapper.firstChild);
  for (const el of before) wrapper.appendChild(el);
  for (const id of newOrder) {
    const el = sectionEls.get(id);
    if (el) wrapper.appendChild(el);
  }
  // newOrder に含まれなかったセクションを末尾に保護
  for (const [id, el] of sectionEls) {
    if (!newOrder.includes(id)) wrapper.appendChild(el);
  }
  for (const el of after) wrapper.appendChild(el);

  return doc.body.innerHTML;
}

/** 指定セクションを HTML から削除（DOM全スキャン） */
/** elementId または selector で要素を HTML から削除する（セクション以外の個別要素用） */
function deleteElementFromHtml(html: string, elementId?: string, selector?: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  let el: Element | null = null;
  if (elementId) el = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!el && selector) el = doc.querySelector(selector);
  if (!el) return html;
  el.remove();
  return doc.body.innerHTML;
}

function removeSectionFromHtml(html: string, sectionId: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const wrapper = doc.querySelector(".lp-wrapper") ?? doc.body;
  const sectionClass = /^lp-([a-z][a-z0-9_]*)$/;
  for (const child of Array.from(wrapper.children)) {
    for (const cls of Array.from(child.classList)) {
      const m = cls.match(sectionClass);
      if (m && m[1] === sectionId) {
        wrapper.removeChild(child);
        break;
      }
    }
  }
  return doc.body.innerHTML;
}

/** 指定セクションの outerHTML を新しい HTML で丸ごと置換 */
function replaceSectionInHtml(html: string, sectionId: string, newSectionHtml: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const wrapper = doc.querySelector(".lp-wrapper") ?? doc.body;
  const sectionClass = /^lp-([a-z][a-z0-9_]*)$/;
  for (const child of Array.from(wrapper.children)) {
    for (const cls of Array.from(child.classList)) {
      const m = cls.match(sectionClass);
      if (m && m[1] === sectionId) {
        const temp = doc.createElement("div");
        temp.innerHTML = newSectionHtml.trim();
        const newEl = temp.firstElementChild;
        if (newEl) wrapper.replaceChild(newEl, child);
        break;
      }
    }
  }
  return doc.body.innerHTML;
}

/** セクション一覧から「お悩み・問題提起」セクションの ID を推定する */
function findProblemSectionId(sections: SortableSection[]): string | null {
  const idKeywords = ["problem", "trouble", "worry", "nayami", "onaymi", "sadami"];
  const labelKeywords = ["悩み", "問題", "お困り", "不安", "こんな", "trouble"];
  return (
    sections.find(
      (s) =>
        idKeywords.some((k) => s.id.includes(k)) ||
        labelKeywords.some((k) => s.label.includes(k))
    )?.id ?? null
  );
}

/** 新セクションを既存 HTML に挿入（CTA 直前 or 末尾） */
function insertSectionHtml(currentHtml: string, newHtml: string, insertAtEnd = false): string {
  if (typeof window === "undefined") return currentHtml;
  const doc = new DOMParser().parseFromString(currentHtml, "text/html");
  const temp = doc.createElement("div");
  temp.innerHTML = newHtml.trim();
  const newEl = temp.firstElementChild;
  if (!newEl) return currentHtml;

  if (insertAtEnd) {
    doc.body.appendChild(newEl);
  } else {
    const wrapper = doc.querySelector(".lp-wrapper") || doc.body;
    const cta = wrapper.querySelector(".lp-cta") || doc.querySelector(".lp-cta");
    if (cta?.parentElement) {
      cta.parentElement.insertBefore(newEl, cta);
    } else {
      wrapper.appendChild(newEl);
    }
  }
  return doc.body.innerHTML;
}

/** ボタン要素を <img> タグに置換（HTML / Netlify 出力用） */
function applyButtonImages(html: string, vs: VisualStyles): string {
  if (typeof window === "undefined") return html;

  const overrides = Object.entries(vs)
    .filter(([, rule]) => rule.imageButton?.url)
    .map(([selector, rule]) => ({ selector, ib: rule.imageButton! }));

  if (overrides.length === 0) return html;

  const doc = new DOMParser().parseFromString(html, "text/html");

  /** ボタン要素のスタイルをリセット（白枠除去） */
  function stripButtonStyle(el: Element) {
    (el as HTMLElement).style.setProperty("background", "transparent", "important");
    (el as HTMLElement).style.setProperty("background-color", "transparent", "important");
    (el as HTMLElement).style.setProperty("background-image", "none", "important");
    (el as HTMLElement).style.setProperty("border", "none", "important");
    (el as HTMLElement).style.setProperty("box-shadow", "none", "important");
    (el as HTMLElement).style.setProperty("padding", "0", "important");
    (el as HTMLElement).style.setProperty("margin", "0", "important");
    (el as HTMLElement).style.setProperty("display", "inline-block", "important");
    (el as HTMLElement).style.setProperty("line-height", "0", "important");
    (el as HTMLElement).style.setProperty("text-decoration", "none", "important");
  }

  /** 親ラッパー要素の背景・枠を除去 */
  function stripWrapStyle(el: Element) {
    (el as HTMLElement).style.setProperty("background", "transparent", "important");
    (el as HTMLElement).style.setProperty("background-color", "transparent", "important");
    (el as HTMLElement).style.setProperty("border", "none", "important");
    (el as HTMLElement).style.setProperty("box-shadow", "none", "important");
  }

  for (const { selector, ib } of overrides) {
    try {
      const el = doc.querySelector(selector);
      if (!el) continue;

      const img = doc.createElement("img");
      img.src = ib.url;
      if (ib.alt) img.alt = ib.alt;

      const fit = ib.fitMode ?? "cover";
      const objectFit = fit === "stretch" ? "fill" : fit;
      const styleProps: string[] = ["display:block", `object-fit:${objectFit}`];
      if (ib.width !== "auto") styleProps.push(`width:${ib.width}`);
      if (ib.maintainRatio) {
        styleProps.push("height:auto");
      } else if (ib.height !== "auto") {
        styleProps.push(`height:${ib.height}`);
      }
      img.setAttribute("style", styleProps.join(";"));

      const tag = el.tagName.toLowerCase();
      if (tag === "a") {
        el.innerHTML = "";
        el.appendChild(img);
        stripButtonStyle(el);
        if (el.parentElement) stripWrapStyle(el.parentElement);
      } else if (tag === "button") {
        const parentEl = el.parentElement;
        const parentTag = parentEl?.tagName.toLowerCase();
        if (parentTag === "a") {
          // <a><button>...</button></a> → <a><img /></a>
          parentEl!.innerHTML = "";
          parentEl!.appendChild(img);
          stripButtonStyle(parentEl!);
          if (parentEl!.parentElement) stripWrapStyle(parentEl!.parentElement);
        } else {
          const grandParent = parentEl;
          el.replaceWith(img);
          if (grandParent) stripWrapStyle(grandParent);
        }
      } else {
        el.innerHTML = "";
        el.appendChild(img);
        stripButtonStyle(el);
        if (el.parentElement) stripWrapStyle(el.parentElement);
      }
    } catch {
      // 個別セレクタのエラーは無視
    }
  }

  return doc.body.innerHTML;
}

function buildNetlifyHtml(
  html: string,
  css: string,
  serviceName: string,
  unsplashImages: UploadedImage[],
  fontUrl?: string,
): string {
  const attrComments = unsplashImages
    .filter((img) => img.attribution)
    .map((img) => `<!-- Photo by ${img.attribution!.photographerName} on Unsplash -->`)
    .join("\n");
  const fontLink = fontUrl
    ? `  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link href="${fontUrl}" rel="stylesheet">`
    : `  <link rel="preconnect" href="https://fonts.googleapis.com">\n  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">`;
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${serviceName}のランディングページ" />
  <title>${serviceName}</title>
${fontLink}
  <style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; }
img { max-width: 100%; height: auto; }
${css}
  </style>
</head>
<body>
${html}${attrComments ? "\n" + attrComments : ""}
</body>
</html>`;
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Accordion ───────────────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = false, badge }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-gray-100 last:border-0">
      <button
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="flex items-center gap-2">
          {title}
          {badge && <span className="text-[10px] bg-[#E6F8FC] text-[#00AFCC] px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
        </span>
        <span className={`text-gray-400 transition-transform text-xs ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Home() {
  // ── Core state ──
  const [result, setResult] = useState<GeneratedLP | null>(null);
  const [loading, setLoading] = useState(false);
  const [revisionLoading, setRevisionLoading] = useState(false);
  const [lastRevisionInstruction, setLastRevisionInstruction] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revisionError, setRevisionError] = useState<string | null>(null);
  const [retryMessage, setRetryMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>("preview");
  const [previewMode, setPreviewMode] = useState<PreviewMode>("desktop");
  const [serviceName, setServiceName] = useState("");
  const [lastFormData, setLastFormData] = useState<LPFormData | null>(null);

  // ── Visual style editing ──
  const [editMode, setEditMode] = useState<EditMode>("text");
  const [selectedElement, setSelectedElement] = useState<SelectedElement | null>(null);
  const [visualStyles, setVisualStyles] = useState<VisualStyles>({});

  // ── Font ──
  const [globalFont, setGlobalFont] = useState<string>(DEFAULT_FONT_ID);
  const globalFontRef = useRef<string>(DEFAULT_FONT_ID);
  globalFontRef.current = globalFont;

  // ── Input method ──
  const [inputMethod, setInputMethod] = useState<InputMethod>("form");
  const [importedValues, setImportedValues] = useState<Partial<LPFormData> | undefined>(undefined);
  // ヒアリングシート貼り付け
  const [hearingText, setHearingText] = useState("");
  const [hearingLoading, setHearingLoading] = useState(false);
  const [hearingError, setHearingError] = useState<string | null>(null);

  // ── Auth ──
  const { user, session, signInWithGoogle, signOut } = useAuth();
  const router = useRouter();

  // ── Plan ──
  const { planType, usage, recordUsage } = usePlan();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeReason, setUpgradeReason]       = useState<string | undefined>(undefined);

  /** アップグレードモーダルを開くヘルパー */
  const openUpgrade = (reason?: string) => {
    setUpgradeReason(reason);
    setShowUpgradeModal(true);
  };

  // ── Publish ──
  const [showPublishPanel, setShowPublishPanel] = useState(false);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(null);

  // ── Project save / load ──
  const [savedProject, setSavedProject] = useState<LPProject | null>(null);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFileRef = useRef<HTMLInputElement>(null);

  // ── Cloud save ──
  /** 現在編集中プロジェクトの Supabase UUID（null = 未保存） */
  const [remoteProjectId, setRemoteProjectId] = useState<string | null>(null);
  /** ?p= パラメータからのプロジェクト読み込み中フラグ */
  const [projectLoading, setProjectLoading] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("p")) {
      setProjectLoading(true);
    }
  }, []);
  type CloudStatus = "idle" | "saving" | "saved" | "error";
  const [cloudStatus, setCloudStatus] = useState<CloudStatus>("idle");

  // ── Undo（スナップショット方式、最大20件）──
  const [undoStack, setUndoStack] = useState<UndoSnapshot[]>([]);

  // ── Images ──
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [unsplashResult, setUnsplashResult] = useState<UnsplashResult | null>(null);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);

  // ── Color theme ──
  const [colorReplacements, setColorReplacements] = useState<Record<string, string>>({});

  // ── Section order ──
  const [sectionOrder, setSectionOrder] = useState<SortableSection[]>([]);
  /** insertAtEnd セクション（固定CTAバーなど）— セクション一覧とは別に管理 */
  const [fixedSections, setFixedSections] = useState<SortableSection[]>([]);

  // ── Section navigation（サイドバークリック → プレビュースクロール）──
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const previewRef = useRef<LPPreviewHandle>(null);

  // refs：useCallback 内で最新値を参照するため（deps に加えない）
  const sectionOrderRef = useRef<SortableSection[]>([]);
  sectionOrderRef.current = sectionOrder;
  const visualStylesRef = useRef<VisualStyles>({});
  visualStylesRef.current = visualStyles;
  const imagesRef = useRef<UploadedImage[]>([]);
  imagesRef.current = images;
  const resultRef = useRef(result);
  resultRef.current = result;

  // ── 参考LP 吹き出し切り替え ──
  const [refAnalysis, setRefAnalysis] = useState<LPAnalysis | null>(null);
  const [refProblemLayout, setRefProblemLayout] = useState<ProblemLayout>("normal");
  const [sectionSwapLoading, setSectionSwapLoading] = useState(false);
  const [sectionSwapError, setSectionSwapError] = useState<string | null>(null);

  // ── Add section ──
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  // ── Delete section ──
  const [deletingSection, setDeletingSection] = useState<{ id: string; label: string } | null>(null);

  // ── 入力情報フォームのリセットキー（再生成のたびにインクリメントして最新値を反映）──
  const [regenFormKey, setRegenFormKey] = useState(0);

  // ── Image prompt assistant ──
  const [promptAssistantOpen, setPromptAssistantOpen] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedImagePrompt[]>([]);
  /** templateId → css （型ごとに1度だけ追加） */
  const [additionalCssByType, setAdditionalCssByType] = useState<Record<string, string>>({});

  // ─── Derived CSS ──────────────────────────────────────────────────────────

  const additionalCss = Object.values(additionalCssByType).join("\n");

  const effectiveCss = useMemo(() => {
    if (!result) return "";

    // 追加セクションの見出しを AI 生成 LP の見出し重みに自動で揃える。
    // result.css 内のタイトル系クラス（lp-*-title / lp-*-heading / lp-*-headline）
    // または h1〜h3 で最初に見つかった font-weight 値を CSS 変数として提供し、
    // テンプレートの var(--lp-heading-weight, 700) が参照する。
    const hwMatch = /(?:\.lp-[a-z0-9-]*(?:title|heading|headline|catch|ttl)[a-z0-9-]*|h[1-3])\b[\s\S]*?\{[\s\S]*?font-weight\s*:\s*(\d+)/.exec(result.css);
    const headingWeight = hwMatch ? hwMatch[1] : "700";
    const headingWeightCss = `:root{--lp-heading-weight:${headingWeight}}\n`;

    let css = headingWeightCss + replaceColors(result.css, colorReplacements);
    if (additionalCss) css += "\n/* 追加セクション */\n" + additionalCss;
    // visualCss を先に、imgCss を後に配置する。
    // どちらも !important を使うため、カスケードで後勝ちになる。
    // 画像オーバーライドはビジュアル編集（background-image: none 等）より優先する必要があるため後配置。
    const visualCss = buildVisualCss(visualStyles);
    if (visualCss) css += "\n" + visualCss;
    const imgCss = buildImageCss(images, result.html);
    if (imgCss) css += "\n/* 画像オーバーライド */\n" + imgCss;
    const fontCss = buildFontCss(globalFont);
    css += "\n" + fontCss;
    return css;
  }, [result, colorReplacements, additionalCss, images, visualStyles, globalFont]);

  /** HTML/Netlify出力用：ボタン画像差し替えを適用したHTML */
  const buttonProcessedHtml = useMemo(() => {
    if (!result?.html) return "";
    return applyButtonImages(result.html, visualStyles);
  }, [result?.html, visualStyles]);

  /** プレビュー用：ボタン画像オーバーライド一覧 */
  const buttonImageOverrides = useMemo<ButtonImageOverride[]>(() => {
    return Object.entries(visualStyles)
      .filter(([, rule]) => rule.imageButton?.url)
      .map(([selector, rule]) => ({ selector, config: rule.imageButton! }));
  }, [visualStyles]);

  const fontGoogleUrl = useMemo(() => getFontGoogleUrl(globalFont), [globalFont]);
  const fontFamily    = useMemo(() => getFontOption(globalFont).cssFamily, [globalFont]);

  const extractedColors = useMemo(() => {
    if (!result?.css) return [];
    return extractTopColors(result.css, 8);
  }, [result?.css]);

  const colorSwatches = useMemo(
    () => extractedColors.map((orig) => ({ original: orig, current: colorReplacements[orig] ?? orig })),
    [extractedColors, colorReplacements]
  );

  const handleColorReplace = useCallback((orig: string, next: string) => {
    setColorReplacements((prev) => ({ ...prev, [orig]: next }));
  }, []);

  const handleColorReset = useCallback(() => {
    pushUndo();
    setColorReplacements({});
  }, [pushUndo]);

  const unsplashImages = images.filter((img) => img.attribution);

  // ── 削除保護セクション（hero 常時・CTA は1つだけなら保護）──
  const protectedSectionIds = useMemo(() => {
    const ids = new Set<string>(["hero"]);
    // CTA 系（id が "cta" を含む）が1つ以下なら保護
    const ctaSections = sectionOrder.filter(
      (s) => s.id === "cta" || s.id.startsWith("cta") || s.id.endsWith("cta")
    );
    if (ctaSections.length <= 1) ctaSections.forEach((s) => ids.add(s.id));
    return ids;
  }, [sectionOrder]);

  // ─── HTML change + Undo ───────────────────────────────────────────────────

  /** HTML 変更 + 必要に応じてスナップショットを積む。refs 経由で sectionOrder/visualStyles を取得するため deps は空。 */
  const applyHtml = useCallback((newHtml: string, saveHistory = true) => {
    setResult((prev) => {
      if (!prev) return prev;
      if (saveHistory) {
        const snapshot: UndoSnapshot = {
          html: prev.html,
          sectionOrder: [...sectionOrderRef.current],
          visualStyles: { ...visualStylesRef.current },
          globalFont: globalFontRef.current,
          images: [...imagesRef.current],
        };
        setUndoStack((h) => [...h.slice(-19), snapshot]);
      }
      return { ...prev, html: newHtml };
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleHtmlChange = useCallback((newHtml: string) => applyHtml(newHtml, true), [applyHtml]);

  /** スタイル編集など HTML 以外の変更前にスナップショットを積む */
  const pushUndo = useCallback(() => {
    if (!result) return;
    const snapshot: UndoSnapshot = {
      html: result.html,
      sectionOrder: [...sectionOrderRef.current],
      visualStyles: { ...visualStylesRef.current },
      globalFont: globalFontRef.current,
      images: [...imagesRef.current],
    };
    setUndoStack((h) => [...h.slice(-19), snapshot]);
  }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const snapshot = undoStack[undoStack.length - 1];
    setUndoStack((h) => h.slice(0, -1));
    setResult((r) => (r ? { ...r, html: snapshot.html } : r));
    setSectionOrder(snapshot.sectionOrder);
    setVisualStyles(snapshot.visualStyles);
    setGlobalFont(snapshot.globalFont ?? DEFAULT_FONT_ID);
    setImages(snapshot.images ?? []);
  }, [undoStack]);

  // ─── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async (data: LPFormData) => {
    // プランチェック
    if (planType === "expired") {
      openUpgrade("トライアル期間が終了しました。Proプランにアップグレードしてください。");
      return;
    }
    if (planType && isLimitReached("generate", usage, planType)) {
      const lim = PLAN_LIMITS[planType].maxGenerate;
      openUpgrade(`LP生成の月間上限（${lim}回）に達しました。Proプランで回数を増やせます。`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setRetryMessage(null);
    setUndoStack([]);
    setColorReplacements({});
    setAdditionalCssByType({});
    setVisualStyles({});
    setSelectedElement(null);
    setEditMode("text");
    setGlobalFont(DEFAULT_FONT_ID);
    setServiceName(data.serviceName);
    setLastFormData(data);
    setUnsplashResult(null);
    try {
      const generated = await generateWithRetry(data, (msg) => setRetryMessage(msg), session?.access_token);
      setResult(generated);
      setSectionOrder(parseSectionOrder(generated.html));
      setActiveTab("preview");
      recordUsage("generate");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
      setRetryMessage(null);
    }
  };

  // ─── Regenerate（カラー・画像設定を引き継いで再生成）─────────────────────────

  const handleRegenerate = async (data: LPFormData) => {
    setLoading(true);
    setError(null);
    setRetryMessage(null);
    setUndoStack([]);
    // colorReplacements・images（ユーザーカスタマイズ）は引き継ぐ
    setVisualStyles({});
    setSelectedElement(null);
    setEditMode("text");
    setServiceName(data.serviceName);
    setLastFormData(data);
    setUnsplashResult(null);
    try {
      const generated = await generateWithRetry(data, (msg) => setRetryMessage(msg), session?.access_token);
      setResult(generated);
      setSectionOrder(parseSectionOrder(generated.html));
      setActiveTab("preview");
      setRegenFormKey((k) => k + 1); // フォームを最新データで再初期化
      recordUsage("generate");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setLoading(false);
      setRetryMessage(null);
    }
  };

  // ─── Revise ───────────────────────────────────────────────────────────────

  const handleRevise = async (instruction: string) => {
    if (!result) return;
    // プランチェック
    if (planType === "expired") {
      openUpgrade("トライアル期間が終了しました。Proプランにアップグレードしてください。");
      return;
    }
    if (planType && isLimitReached("ai_edit", usage, planType)) {
      const lim = PLAN_LIMITS[planType].maxAiEdit;
      openUpgrade(`AI編集の月間上限（${lim}回）に達しました。Proプランで回数を増やせます。`);
      return;
    }
    setRevisionLoading(true);
    setRevisionError(null);
    setLastRevisionInstruction(instruction);
    setUndoStack([]);
    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ html: result.html, css: result.css, instruction }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "修正に失敗しました");
      setResult(json as GeneratedLP);
      setSectionOrder(parseSectionOrder((json as GeneratedLP).html));
      setActiveTab("preview");
      recordUsage("ai_edit");
    } catch (err: unknown) {
      setRevisionError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setRevisionLoading(false);
    }
  };

  // ─── Add section ──────────────────────────────────────────────────────────

  const handleAddSection = (html: string, css: string, templateId: string) => {
    if (!result) return;
    const template = SECTION_TEMPLATES.find((t) => t.id === templateId);
    const newHtml = insertSectionHtml(result.html, html, template?.insertAtEnd);
    applyHtml(newHtml, true);
    // CSS は型ごとに1度だけ（複数インスタンスでも共通CSSは1回のみ）
    setAdditionalCssByType((prev) => ({ ...prev, [templateId]: css }));
    // SectionSorter に追加（insertAtEnd は固定要素として別管理）
    if (template?.insertAtEnd) {
      setFixedSections((prev) => {
        if (prev.some((s) => s.id === templateId)) return prev;
        const meta = SECTION_META[templateId] ?? templateId;
        return [...prev, { id: templateId, label: meta }];
      });
    } else {
      setSectionOrder((prev) => {
        // multipleAllowed テンプレート：HTML から一意クラスを取り出してインスタンス ID にする
        let sectionId = templateId;
        if (template?.multipleAllowed && typeof window !== "undefined") {
          const doc = new DOMParser().parseFromString(html, "text/html");
          const sec = doc.querySelector(`.lp-${templateId}`);
          if (sec) {
            const uniqueCls = Array.from(sec.classList).find(
              (c) => c !== `lp-${templateId}` && c.startsWith(`lp-${templateId}_`)
            );
            if (uniqueCls) sectionId = uniqueCls.replace(/^lp-/, "");
          }
        }
        // 通常テンプレートは重複追加を防ぐ
        if (!template?.multipleAllowed && prev.some((s) => s.id === sectionId)) return prev;
        const label = SECTION_META[templateId] ?? template?.label ?? templateId;
        // CTA の前に挿入
        const ctaIdx = prev.findIndex((s) => s.id === "cta");
        const next = [...prev];
        next.splice(ctaIdx >= 0 ? ctaIdx : next.length, 0, { id: sectionId, label });
        return next;
      });
    }
  };

  // ─── Section delete ───────────────────────────────────────────────────────

  /** 削除確認モーダルを開く */
  const handleDeleteRequest = useCallback((id: string, label: string) => {
    setDeletingSection({ id, label });
  }, []);

  /** モーダル確認後の実削除（Undo スタック付き） */
  const handleDeleteConfirm = useCallback(() => {
    if (!deletingSection || !result) return;
    const { id } = deletingSection;

    // applyHtml が sectionOrderRef.current（削除前の状態）をスナップショットに取り込む
    const newHtml = removeSectionFromHtml(result.html, id);
    const newSectionOrder = sectionOrder.filter((s) => s.id !== id);
    const newImages = images.filter((img) => img.placement !== id);

    applyHtml(newHtml, true);            // ← undo スナップショット作成 + html 更新
    setSectionOrder(newSectionOrder);   // ← 順序更新（スナップショット取得後）
    setFixedSections((prev) => prev.filter((s) => s.id !== id)); // ← 固定要素も削除
    setImages(newImages);               // ← 関連画像削除（undo では非復元・許容）
    if (activeSectionId === id) setActiveSectionId(null);

    setDeletingSection(null);
  }, [deletingSection, result, sectionOrder, images, activeSectionId, applyHtml]);

  // ─── Section navigation（クリック → プレビュースクロール）──────────────────

  const handleSectionClick = useCallback((id: string) => {
    setActiveSectionId(id);
    // プレビュータブが表示中でなければ切り替える
    setActiveTab("preview");
    // iframe への scroll 指示（タブ切り替えで iframe が再マウントされる前に
    // 少し遅延させて確実にスクロール）
    setTimeout(() => {
      previewRef.current?.scrollToSection(id);
    }, 50);
  }, []);

  // ─── Section reorder ──────────────────────────────────────────────────────
  // SectionSorter から from/to インデックスを受け取り、page.tsx 側で全処理を行う。
  // resultRef / sectionOrderRef 経由で常に最新値を取得するため deps は [applyHtml] のみ。
  // ドラッグ操作・▲▼ボタン、どちらも必ずこの関数が呼ばれる。

  const handleReorderByIndex = useCallback((fromIndex: number, toIndex: number) => {
    const currentResult = resultRef.current;
    const currentSections = sectionOrderRef.current;

    if (!currentResult) return;
    if (
      fromIndex === toIndex ||
      fromIndex < 0 || toIndex < 0 ||
      fromIndex >= currentSections.length || toIndex >= currentSections.length
    ) return;

    // 新しいセクション順を計算
    const next = [...currentSections];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    const newOrder = next.map(s => s.id);

    // HTML を並び替え
    const reorderedHtml = reorderHtmlSections(currentResult.html, newOrder);

    // ① 即座にプレビューを更新（React の非同期チェーンを待たない）
    //    forceRefreshWithHtml が skipNextRef = true にセットするため
    //    直後の buildContent effect は二重更新を防ぐためスキップされる
    previewRef.current?.forceRefreshWithHtml(reorderedHtml);

    // ② 左パネルと React state を更新（Undo スタック含む）
    setSectionOrder(next);
    applyHtml(reorderedHtml, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [applyHtml]);

  // ─── Unsplash ─────────────────────────────────────────────────────────────

  const handleUnsplashFetch = async () => {
    if (!lastFormData) return;
    setUnsplashLoading(true);
    setUnsplashError(null);
    try {
      const res = await fetch("/api/unsplash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          industry: lastFormData.industry,
          target: lastFormData.target,
          serviceDetail: lastFormData.serviceDetail,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "画像提案に失敗しました");
      setUnsplashResult(json as UnsplashResult);
    } catch (err: unknown) {
      setUnsplashError(err instanceof Error ? err.message : "不明なエラーが発生しました");
    } finally {
      setUnsplashLoading(false);
    }
  };

  const handleImageSelect = (image: UploadedImage) => {
    pushUndo();
    setImages((prev) => [
      ...prev.filter((img) => !(img.placement === image.placement && img.attribution)),
      image,
    ]);
  };

  const handleImageDeselect = (placement: string) => {
    pushUndo();
    setImages((prev) => prev.filter((img) => !(img.placement === placement && img.attribution)));
  };

  /** 画像追加・差し替え・削除を undo スタックに記録してから適用する */
  const handleImagesChange = useCallback((newImages: UploadedImage[]) => {
    pushUndo();
    setImages(newImages);
  }, [pushUndo]);

  // ─── Visual style update ──────────────────────────────────────────────────

  const handleStyleUpdate = (selector: string, rule: StyleRule) => {
    pushUndo();
    setVisualStyles((prev) => ({ ...prev, [selector]: rule }));
  };

  const handleElementSelect = (el: SelectedElement | null) => {
    // セクション要素かつ背景色が transparent / 白 (= gradient fallback) の場合、
    // CSS テキストから直接パースして正しい背景色を補完する。
    // ※ visualStyles オーバーライドを含む effectiveCss ではなく result.css（元 CSS）を使う。
    //   そうしないと「誤って白を保存した場合」に visual override 側の白が返ってしまう。
    if (el && el.type === "section") {
      const bg = el.computedStyles.backgroundColor ?? "";
      const bgAlpha = (() => {
        const m = bg.match(/^rgba\s*\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/);
        return m ? parseFloat(m[1]) : null;
      })();
      const isBgUnclear =
        !bg ||
        bg === "transparent" ||
        bg === "rgb(255, 255, 255)" ||
        /^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(bg.trim()) ||
        // alpha < 0.15 の rgba は事実上透明（lp-vs-a の rgba(99,102,241,.05) 等）
        (bgAlpha !== null && bgAlpha < 0.15);
      if (isBgUnclear) {
        // result.css に colorReplacements を適用したものを使う（visual/image override は除外）
        const baseCss = result?.css ? replaceColors(result.css, colorReplacements) : "";
        const fromCss = extractBgFromSelector(el.selector, baseCss, el.lpClasses);
        if (fromCss) {
          el = { ...el, computedStyles: { ...el.computedStyles, backgroundColor: fromCss } };
        }
      }
    }
    setSelectedElement(el);
  };

  const handleEditModeToggle = (mode: EditMode) => {
    setEditMode(mode);
    if (mode === "text") setSelectedElement(null);
  };

  // ─── Project: apply（復元・読み込み共通）────────────────────────────────────

  const applyProject = useCallback((project: LPProject) => {
    // HTML から直接ラベルを抽出して sectionOrder を構築する
    // （useEffect に依存せず、同一HTMLの再ロードでも正しく反映される）
    const fresh = parseSectionOrder(project.html);
    const labelMap = new Map(fresh.map((s) => [s.id, s.label]));
    setSectionOrder(project.sectionOrder.map((s) => ({
      id: s.id,
      label: labelMap.get(s.id) ?? s.id,
    })));
    setResult({ html: project.html, css: project.css });
    setLastFormData(project.formData);
    setServiceName(project.formData.serviceName);
    setColorReplacements(project.colorReplacements);
    setVisualStyles(project.visualStyles);
    setAdditionalCssByType(project.additionalCssByType);
    setImages(deserializeImages(project.images));
    setUndoStack([]);
    setActiveTab("preview");
    setEditMode("text");
    setSelectedElement(null);
    setUnsplashResult(null);
    setSavedProject(project);
    setShowRestoreBanner(false);
    // JSON ファイルから読み込んだ場合は remoteId があれば復元する（上書き保存に使用）
    if (project.remoteId) setRemoteProjectId(project.remoteId);
  // setRemoteProjectId は安定した参照なので依存配列への追加は不要だが明示しておく
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setRemoteProjectId]);

  // ─── Project: スナップショットを API ペイロードに変換 ─────────────────────────

  const buildCloudPayload = useCallback(async (opts: { fullBlob?: boolean } = {}) => {
    if (!result || !lastFormData) return null;
    const imgs = opts.fullBlob ? await serializeImages(images) : serializeImagesSync(images);
    const snap: ProjectSnapshot = {
      formData: lastFormData, html: result.html, css: result.css,
      colorReplacements, visualStyles, sectionOrder, additionalCssByType,
      images: imgs,
    };
    const project = buildProject(snap);
    return {
      title: project.name,
      html: project.html,
      css: project.css,
      project_json: project as unknown as Record<string, unknown>,
    };
  }, [result, lastFormData, images, colorReplacements, visualStyles, sectionOrder, additionalCssByType]);

  // ─── Project: クラウド保存（新規作成 or 更新）────────────────────────────────

  const handleSaveRemote = useCallback(async () => {
    if (!session) return;
    const payload = await buildCloudPayload({ fullBlob: true });
    if (!payload) return;
    setCloudStatus("saving");
    setIsSaving(true);
    setSaveMenuOpen(false);
    try {
      let res: Response;
      if (remoteProjectId) {
        res = await fetch(`/api/projects/${remoteProjectId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify(payload),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "保存失敗");
      if (!remoteProjectId) setRemoteProjectId(json.id);
      setCloudStatus("saved");
      setSaveToast("クラウドに保存しました ☁");
      setTimeout(() => { setSaveToast(null); setCloudStatus("idle"); }, 3000);
    } catch (e) {
      setCloudStatus("error");
      setSaveToast(e instanceof Error ? e.message : "クラウド保存に失敗しました");
      setTimeout(() => { setSaveToast(null); setCloudStatus("idle"); }, 3000);
    } finally {
      setIsSaving(false);
    }
  }, [session, remoteProjectId, buildCloudPayload]);

  // ─── Project: ローカル保存（同期・高速）──────────────────────────────────────

  const handleSaveLocal = () => {
    if (!result || !lastFormData) return;
    const snap: ProjectSnapshot = {
      formData: lastFormData,
      html: result.html, css: result.css,
      colorReplacements, visualStyles, sectionOrder, additionalCssByType,
      images: serializeImagesSync(images),
    };
    const project = buildProject(snap, {
      existingId: savedProject?.id,
      remoteId: remoteProjectId ?? undefined,
    });
    saveToLocal(project);
    setSavedProject(project);
    setSaveMenuOpen(false);
    setSaveToast("ローカルに保存しました");
    setTimeout(() => setSaveToast(null), 2500);
  };

  // ─── Project: JSON ダウンロード（非同期・blob 変換あり）──────────────────────

  const handleDownloadJSON = async () => {
    if (!result || !lastFormData) return;
    setIsSaving(true);
    setSaveMenuOpen(false);
    try {
      const serializedImages = await serializeImages(images);
      const snap: ProjectSnapshot = {
        formData: lastFormData,
        html: result.html, css: result.css,
        colorReplacements, visualStyles, sectionOrder, additionalCssByType,
        images: serializedImages,
      };
      const project = buildProject(snap, {
        existingId: savedProject?.id,
        remoteId: remoteProjectId ?? undefined,
      });
      saveToLocal(project);
      setSavedProject(project);
      downloadProject(project);
      setSaveToast("JSON を書き出しました");
      setTimeout(() => setSaveToast(null), 2500);
    } catch (e) {
      setSaveToast("書き出しに失敗しました");
      setTimeout(() => setSaveToast(null), 2500);
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── Project: JSON 読み込み ────────────────────────────────────────────────

  const handleLoadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const project = await parseProjectFile(file);
      applyProject(project);
      setSaveToast(`「${project.name}」を読み込みました`);
      setTimeout(() => setSaveToast(null), 3000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "読み込みに失敗しました");
    }
    e.target.value = "";
  };

  // ─── Project: 復元バナー ─────────────────────────────────────────────────

  const handleRestore = () => {
    if (savedProject) applyProject(savedProject);
  };

  const handleDismissRestore = () => {
    setShowRestoreBanner(false);
    clearLocal();
    setSavedProject(null);
    // 復元しない場合はクラウドIDもリセット（新規LPが既存エントリを上書きしないようにする）
    setRemoteProjectId(null);
  };

  // ─── Ref LP complete ──────────────────────────────────────────────────────

  const handleRefComplete = (
    generated: GeneratedLP,
    formData: LPFormData,
    lpAnalysis: LPAnalysis,
    currentLayout: ProblemLayout,
  ) => {
    setResult(generated);
    setLastFormData(formData);
    setServiceName(formData.serviceName);
    setSectionOrder(parseSectionOrder(generated.html));
    setColorReplacements({});
    setAdditionalCssByType({});
    setVisualStyles({});
    setSelectedElement(null);
    setEditMode("text");
    setUndoStack([]);
    setActiveTab("preview");
    setUnsplashResult(null);
    setInputMethod("form");
    // 参考LP吹き出し切り替え用に保存
    setRefAnalysis(lpAnalysis ?? null);
    setRefProblemLayout(currentLayout ?? "normal");
    setSectionSwapError(null);
  };

  // ─── 問題セクション レイアウト切り替え ─────────────────────────────────────

  const handleSwapProblemLayout = useCallback(async () => {
    if (!result || !lastFormData) return;
    const newLayout: ProblemLayout = refProblemLayout === "normal" ? "bubble" : "normal";
    const problemSectionId = findProblemSectionId(sectionOrderRef.current);
    if (!problemSectionId) {
      setSectionSwapError("お悩みセクションが見つかりませんでした");
      return;
    }
    const sec = sectionOrderRef.current.find((s) => s.id === problemSectionId);

    setSectionSwapLoading(true);
    setSectionSwapError(null);
    try {
      const res = await fetch("/api/regenerate-section", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          sectionId: problemSectionId,
          sectionName: sec?.label ?? problemSectionId,
          sectionRole: refAnalysis?.sections?.find((s) => s.id === problemSectionId)?.role ?? "ターゲットのお悩みを提起し共感を得るセクション",
          analysis: refAnalysis ?? null,
          serviceInfo: lastFormData,
          problemLayout: newLayout,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "切り替えに失敗しました");

      const newHtml = replaceSectionInHtml(resultRef.current!.html, problemSectionId, json.html);
      applyHtml(newHtml, true);
      if (json.css?.trim()) {
        setAdditionalCssByType((prev) => ({ ...prev, [`problem-swap-${newLayout}`]: json.css }));
      }
      setRefProblemLayout(newLayout);
    } catch (err) {
      setSectionSwapError(err instanceof Error ? err.message : "切り替えに失敗しました");
    } finally {
      setSectionSwapLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, lastFormData, refAnalysis, refProblemLayout, applyHtml]);

  // ─── Site importer ────────────────────────────────────────────────────────

  const handleSiteDataApply = (data: Partial<LPFormData>) => {
    setImportedValues(data);
    setInputMethod("form");
  };

  // ─── Hearing sheet analyzer ───────────────────────────────────────────────

  const handleHearingAnalyze = async () => {
    if (!hearingText.trim()) return;
    // プランチェック
    if (planType === "expired") {
      openUpgrade("トライアル期間が終了しました。Proプランにアップグレードしてください。");
      return;
    }
    if (planType && isLimitReached("analyze", usage, planType)) {
      const lim = PLAN_LIMITS[planType].maxAnalyze;
      openUpgrade(`解析の月間上限（${lim}回）に達しました。Proプランで回数を増やせます。`);
      return;
    }
    setHearingLoading(true);
    setHearingError(null);
    try {
      const res = await fetch("/api/analyze-site", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ text: hearingText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "解析に失敗しました");
      const { serviceName, industry, target, area, serviceDetail, price, strengths, designMood, ctaType, ctaLink } = json;
      const ct = (["line", "phone", "contact"].includes(ctaType) ? ctaType : "contact") as "line" | "phone" | "contact";
      setImportedValues({ serviceName, industry, target, area, serviceDetail, price, strengths, designMood, ctaType: ct, ctaLink });
      setInputMethod("form");
      recordUsage("analyze");
    } catch (err) {
      setHearingError(err instanceof Error ? err.message : "解析に失敗しました");
    } finally {
      setHearingLoading(false);
    }
  };

  // ─── Ctrl+Z キーボードショートカット ────────────────────────────────────────

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleUndo]);

  // ─── セクションラベル再スキャン（result.html が変わるたび）─────────────────
  // localStorage 復元・JSON ロード・undo・revision いずれの場合も
  // HTML から h2/h3/代表テキストを再抽出して sectionOrder のラベルを最新化する。
  // 順序（ドラッグ結果）は保持し、ラベルだけ上書きする。
  useEffect(() => {
    if (!result?.html) return;
    const fresh = parseSectionOrder(result.html);
    if (fresh.length === 0) return;
    const labelMap = new Map(fresh.map((s) => [s.id, s.label]));
    setSectionOrder((prev) => {
      const next = prev.map((s) => ({ ...s, label: labelMap.get(s.id) ?? s.label }));
      // ラベルが一件も変わっていなければ参照を変えない（不要な再レンダー防止）
      const changed = next.some((s, i) => s.label !== prev[i]?.label);
      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.html]);

  // ─── Project: mount ──────────────────────────────────────────────────────

  useEffect(() => {
    const p = loadFromLocal();
    if (p) {
      setSavedProject(p);
      setShowRestoreBanner(true);
      // クラウド保存済みの場合は remoteId を復元し、再保存時に重複が起きないようにする
      if (p.remoteId) setRemoteProjectId(p.remoteId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Project: remoteProjectId が確定したら即座に localStorage を更新 ───────
  // クラウド自動保存（30s）後に remoteId が決まっても、ローカル自動保存（2s）の
  // deps に remoteProjectId が入っていないため、内容変更がないと localStorage に
  // remoteId が書き込まれない。これによりリロード後に新規プロジェクトが重複作成される
  // バグを防ぐため、remoteProjectId 変化時に localStorage を即時更新する。
  useEffect(() => {
    if (!remoteProjectId) return;
    const p = loadFromLocal();
    if (p && p.remoteId !== remoteProjectId) {
      saveToLocal({ ...p, remoteId: remoteProjectId });
    }
  }, [remoteProjectId]);

  // ─── Project: URL ?p=<id> でクラウドからロード ───────────────────────────
  // useSearchParams は Suspense 必須のため window.location.search で代替する

  useEffect(() => {
    if (!session) return;
    const pid = new URLSearchParams(window.location.search).get("p");
    if (!pid) return;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${pid}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) return;
        const row = await res.json();
        const project = row.project_json as LPProject;
        if (!project?.html) { setProjectLoading(false); return; }
        applyProject(project);
        setRemoteProjectId(pid);
        // URL パラメータを消す
        router.replace("/");
      } catch { /* ignore */ } finally { setProjectLoading(false); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ─── Project: auto-save ─────────────────────────────────────────────────────
  // ・常時: 2秒デバウンスで localStorage に保存
  // ・ログイン中: 30秒インターバルでクラウドに保存（変更検知付き）

  const cloudAutoSaveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isDirtyRef = useRef(false);
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const remoteProjectIdRef = useRef(remoteProjectId);
  remoteProjectIdRef.current = remoteProjectId;
  const buildCloudPayloadRef = useRef(buildCloudPayload);
  buildCloudPayloadRef.current = buildCloudPayload;

  useEffect(() => {
    if (!result || !lastFormData) return;
    // localStorage 2秒デバウンス
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const snap: ProjectSnapshot = {
        formData: lastFormData,
        html: result.html, css: result.css,
        colorReplacements, visualStyles, sectionOrder, additionalCssByType,
        images: serializeImagesSync(images),
      };
      saveToLocal(buildProject(snap, { remoteId: remoteProjectIdRef.current ?? undefined }));
    }, 2000);
    // 変更フラグを立てる（クラウド自動保存用）
    isDirtyRef.current = true;
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, lastFormData, colorReplacements, visualStyles, sectionOrder, additionalCssByType, images]);

  // ログイン中のみ 30秒ごとにクラウド自動保存
  useEffect(() => {
    if (cloudAutoSaveTimerRef.current) clearInterval(cloudAutoSaveTimerRef.current);
    if (!session) return;
    cloudAutoSaveTimerRef.current = setInterval(async () => {
      if (!isDirtyRef.current) return;
      const currentSession = sessionRef.current;
      if (!currentSession) return;
      const payload = await buildCloudPayloadRef.current();
      if (!payload) return;
      isDirtyRef.current = false;
      setCloudStatus("saving");
      try {
        const pid = remoteProjectIdRef.current;
        const res = pid
          ? await fetch(`/api/projects/${pid}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSession.access_token}` }, body: JSON.stringify(payload) })
          : await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentSession.access_token}` }, body: JSON.stringify(payload) });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error);
        if (!pid) setRemoteProjectId(json.id);
        setCloudStatus("saved");
        setTimeout(() => setCloudStatus("idle"), 3000);
      } catch {
        setCloudStatus("error");
        setTimeout(() => setCloudStatus("idle"), 3000);
      }
    }, 30000);
    return () => { if (cloudAutoSaveTimerRef.current) clearInterval(cloudAutoSaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const RESULT_TABS: { id: ResultTab; label: string }[] = [
    { id: "preview", label: "プレビュー" },
    { id: "html", label: "HTML" },
    { id: "css", label: "CSS" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  if (projectLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-[#F5F5F2] gap-4">
        <div className="w-10 h-10 border-4 border-[#00AFCC]/30 border-t-[#00AFCC] rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">LP を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F5F2]">
      <UpgradeModal
        open={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        reason={upgradeReason}
      />
      <PublishPanel
        open={showPublishPanel}
        onClose={() => setShowPublishPanel(false)}
        projectId={remoteProjectId}
        projectTitle={serviceName || "無題LP"}
        session={session}
        onPublishChange={(published, slug) => {
          setPublishedSlug(published ? slug : null);
        }}
      />
      <AddSectionModal
        open={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        onAdd={handleAddSection}
      />
      <GalleryModal
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        onSelect={(img) => {
          const newImage = {
            id: `gallery-${Date.now()}`,
            url: img.src,
            name: img.alt,
            placement: "gallery" as const,
          };
          handleImageSelect(newImage as Parameters<typeof handleImageSelect>[0]);
        }}
      />
      <ImagePromptAssistant
        open={promptAssistantOpen}
        onClose={() => setPromptAssistantOpen(false)}
        lpContext={lastFormData ?? undefined}
        savedPrompts={savedPrompts}
        onSave={(p) => setSavedPrompts((prev) => [p, ...prev])}
      />

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#F7F7F4] border-b border-[#D8D8D2] z-20">
        <div className="px-4 h-14 flex items-center gap-3">
          {/* Logo mark */}
          <div className="w-9 h-9 rounded-xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-[11px] tracking-tight shrink-0">
            AI
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-[15px] font-black text-gray-900 leading-tight tracking-[0.15em]">AI LP STUDIO</h1>
            {user && <PlanBadge />}
          </div>

          {/* ── 保存・読み込みボタン ── */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* 新規作成（LP生成後のみ） */}
            {result && (
              <Tooltip text="現在のLPを破棄して新規作成" position="bottom">
                <button
                  onClick={() => {
                    if (confirm("現在の編集内容を破棄して新規作成しますか？\n（保存していない変更は失われます）")) {
                      window.location.href = "/";
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  ＋ <span className="hidden sm:inline">新規</span>
                </button>
              </Tooltip>
            )}

            {/* 読み込む（常時表示） */}
            <Tooltip text="JSONファイルからLPを読み込む" position="bottom">
              <label className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors">
                📂
                <span className="hidden sm:inline">読み込む</span>
                <input
                  ref={loadFileRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleLoadFile}
                />
              </label>
            </Tooltip>

            {/* 保存（LP 生成後のみ） */}
            {result && (
              <div className="relative">
                <Tooltip text="クラウド・ローカルに保存" position="bottom">
                  <button
                    onClick={() => setSaveMenuOpen((o) => !o)}
                    disabled={isSaving}
                    className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    {isSaving
                      ? <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />保存中</>
                      : <>💾 <span className="hidden sm:inline">保存</span> ▾</>
                    }
                  </button>
                </Tooltip>
                {saveMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setSaveMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 min-w-[200px]">
                      {/* クラウド保存（ログイン時のみ） */}
                      {user && (
                        <>
                          <button
                            onClick={handleSaveRemote}
                            disabled={isSaving}
                            className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#E6F8FC] transition-colors flex items-center gap-2 disabled:opacity-50"
                          >
                            <span>☁️</span>
                            <div>
                              <p className="font-semibold text-gray-800">クラウドに保存</p>
                              <p className="text-[10px] text-gray-400">
                                {remoteProjectId ? "上書き保存" : "新規保存"}
                              </p>
                            </div>
                          </button>
                          <div className="border-t border-gray-100 my-1" />
                        </>
                      )}
                      <button
                        onClick={handleSaveLocal}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#E6F8FC] transition-colors flex items-center gap-2"
                      >
                        <span>💾</span>
                        <div>
                          <p className="font-semibold text-gray-800">ローカルに保存</p>
                          <p className="text-[10px] text-gray-400">ブラウザに即時保存</p>
                        </div>
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={handleDownloadJSON}
                        disabled={isSaving}
                        className="w-full text-left px-3 py-2.5 text-xs hover:bg-[#E6F8FC] transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <span>⬇</span>
                        <div>
                          <p className="font-semibold text-gray-800">JSON をダウンロード</p>
                          <p className="text-[10px] text-gray-400">ファイルとして書き出し</p>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 自動保存ステータス（ログイン中） */}
            {user && result && cloudStatus !== "idle" && (
              <div className="hidden sm:flex items-center gap-1 text-[10px]">
                {cloudStatus === "saving" && <><div className="w-2.5 h-2.5 border border-gray-400 border-t-transparent rounded-full animate-spin" /><span className="text-gray-400">保存中</span></>}
                {cloudStatus === "saved"  && <><span className="text-green-500">✓</span><span className="text-gray-400">保存済み</span></>}
                {cloudStatus === "error"  && <><span className="text-red-400">✗</span><span className="text-red-400">保存失敗</span></>}
              </div>
            )}

            {result && cloudStatus === "idle" && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-xs text-gray-400">AI生成完了</span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
            )}

            {/* 公開ボタン（LP生成後かつログイン中） */}
            {result && user && (
              <Tooltip text={publishedSlug ? "公開設定を変更する" : "LPを公開URLで公開する"} position="bottom">
                <button
                  onClick={() => setShowPublishPanel(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold bg-[#00AFCC] hover:bg-[#0099B3] text-white rounded-lg transition-colors"
                >
                  🚀 <span className="hidden sm:inline">{publishedSlug ? "公開中" : "公開"}</span>
                </button>
              </Tooltip>
            )}

            {/* 使い方 */}
            <Tooltip text="操作マニュアルを見る" position="bottom">
              <button
                onClick={() => router.push("/how-to-use")}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                ❓ 使い方
              </button>
            </Tooltip>

            {/* マイLP */}
            {user && (
              <Tooltip text="保存済みのLPを管理する" position="bottom">
                <button
                  onClick={() => router.push("/my-lps")}
                  className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  📁 マイLP
                </button>
              </Tooltip>
            )}

            {/* ユーザー表示 / ログインボタン */}
            {user ? (
              <div className="relative group">
                <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors">
                  <div className="w-6 h-6 rounded-full bg-[#00AFCC] flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {(user.email?.[0] ?? "U").toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-[11px] text-gray-600 max-w-[100px] truncate">
                    {user.email}
                  </span>
                </div>
                {/* ドロップダウン */}
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 min-w-[160px] hidden group-hover:block">
                  <button
                    onClick={() => router.push("/my-lps")}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors font-semibold text-gray-700"
                  >
                    📁 マイLP
                  </button>
                  <button
                    onClick={() => router.push("/leads")}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors font-semibold text-gray-700"
                  >
                    📬 リード管理
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={signOut}
                    className="w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors text-red-500 font-semibold"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={signInWithGoogle}
                className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                ログイン
              </button>
            )}
          </div>
        </div>
      </header>

      {/* ── 保存トースト ── */}
      {saveToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-gray-900 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 animate-in">
          <span className="text-green-400">✓</span>
          {saveToast}
        </div>
      )}

      {/* ── Expired plan banner ── */}
      {planType === "expired" && (
        <div className="flex-shrink-0 bg-red-50 border-b border-red-200 px-4 py-2.5 flex items-center gap-3">
          <span className="text-red-500 text-sm">⚠️</span>
          <p className="text-xs font-semibold text-red-700 flex-1">
            トライアル期間が終了しました。プレビュー・マイLP閲覧のみ可能です。
          </p>
          <button
            onClick={() => openUpgrade()}
            className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-[11px] font-bold rounded-lg transition-colors shrink-0"
          >
            アップグレード
          </button>
          <a
            href="/pricing"
            className="px-3 py-1.5 border border-red-300 text-red-600 text-[11px] font-bold rounded-lg hover:bg-red-100 transition-colors shrink-0"
          >
            料金を見る
          </a>
        </div>
      )}

      {/* ── Body (up to three panels) ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ═══ LEFT PANEL ═══ */}
        <aside className="w-72 xl:w-80 shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-y-auto z-10">

          {!result ? (
            /* ── Before generation: input method tabs + form ── */
            <div className="flex flex-col h-full">
              {/* Input method tab bar */}
              <div className="flex border-b border-gray-200 shrink-0">
                {(
                  [
                    { id: "form", label: "✏ フォーム", tip: "情報を手入力してLP生成" },
                    { id: "url",  label: "🌐 URL",     tip: "既存サイトURLから自動入力" },
                    { id: "text", label: "📋 貼付",    tip: "ヒアリングシートから自動入力" },
                    { id: "ref",  label: "🔍 参考LP",  tip: "参考LPを分析してスタイルを反映" },
                  ] as { id: InputMethod; label: string; tip: string }[]
                ).map((tab) => (
                  <Tooltip key={tab.id} text={tab.tip} position="bottom" className="flex-1">
                    <button
                      onClick={() => setInputMethod(tab.id)}
                      className={`w-full py-2.5 text-[11px] font-semibold transition-colors border-b-2
                        ${inputMethod === tab.id
                          ? "text-[#00AFCC] border-[#00AFCC] bg-[#E6F8FC]"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      {tab.label}
                    </button>
                  </Tooltip>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">

                {/* ── 前回の作業を復元バナー ── */}
                {showRestoreBanner && savedProject && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5">
                    <p className="text-xs font-bold text-amber-800 mb-0.5">
                      📂 前回の作業を復元しますか？
                    </p>
                    <p className="text-[10px] text-amber-600 mb-2.5">
                      {savedProject.name} — {formatSavedAt(savedProject.savedAt)}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleRestore}
                        className="flex-1 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-lg transition-colors"
                      >
                        復元する
                      </button>
                      <button
                        onClick={handleDismissRestore}
                        className="flex-1 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 rounded-lg border border-amber-200 transition-colors"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                )}

                {/* ── フォーム入力 ── */}
                {inputMethod === "form" && (
                  <>
                    {importedValues && (
                      <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700">
                        <span>✓</span>
                        <span className="flex-1">サイト情報をフォームに反映しました。内容を確認して生成してください。</span>
                        <button
                          onClick={() => setImportedValues(undefined)}
                          className="text-green-400 hover:text-green-600 font-bold leading-none"
                        >×</button>
                      </div>
                    )}
                    <LPForm onSubmit={handleGenerate} loading={loading} importedValues={importedValues} />
                  </>
                )}

                {/* ── URL読み込み ── */}
                {inputMethod === "url" && (
                  <SiteImporter onApply={handleSiteDataApply} />
                )}

                {/* ── 参考LP分析 ── */}
                {inputMethod === "ref" && (
                  <LPRefAnalyzer
                    initialServiceData={lastFormData ?? importedValues ?? undefined}
                    onComplete={handleRefComplete}
                  />
                )}


                {/* ── ヒアリングシート貼り付け ── */}
                {inputMethod === "text" && (
                  <div className="space-y-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">ヒアリングシート貼り付け</h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        ヒアリングシートや営業資料のテキストを貼り付けると、AIがフォームを自動入力します。
                      </p>
                    </div>
                    <textarea
                      value={hearingText}
                      onChange={(e) => setHearingText(e.target.value)}
                      rows={10}
                      placeholder={"ヒアリングシートや会社概要のテキストを貼り付けてください…\n\n例：\n店舗名：らく楽整骨院\n業種：整骨院\nターゲット：30〜50代の腰痛に悩む女性\n地域：東京都渋谷区\nサービス：産後の骨盤矯正に特化…"}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#00AFCC] transition"
                    />
                    {hearingError && (
                      <p className="text-xs text-red-600 bg-red-50 rounded p-2">{hearingError}</p>
                    )}
                    <button
                      onClick={handleHearingAnalyze}
                      disabled={!hearingText.trim() || hearingLoading}
                      className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
                    >
                      {hearingLoading ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                          AIが解析中…
                        </>
                      ) : "🤖 AIで自動入力する"}
                    </button>
                  </div>
                )}

                {/* ── Loading / Error (form tab) ── */}
                {inputMethod === "form" && loading && (
                  <div className="flex flex-col items-center gap-2 py-4">
                    <div className="w-8 h-8 border-4 border-[#D8D8D2] border-t-[#00AFCC] rounded-full animate-spin" />
                    {retryMessage ? (
                      <p className="text-xs font-medium text-amber-600 text-center">{retryMessage}</p>
                    ) : (
                      <p className="text-xs text-gray-500 text-center">AI生成中…（30〜60秒）</p>
                    )}
                  </div>
                )}
                {inputMethod === "form" && error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                    <strong>エラー：</strong> {error}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* ── After generation: editing tools ── */
            <div className="divide-y divide-gray-100">

              {/* 自動保存インジケーター */}
              {savedProject && (
                <div className="px-4 py-2 flex items-center gap-1.5 text-[10px] text-gray-400 bg-gray-50 border-b border-gray-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                  自動保存済み — {formatSavedAt(savedProject.savedAt)}
                </div>
              )}

              {/* 画像生成プロンプト */}
              <div className="px-4 py-3 border-b border-gray-100">
                <Tooltip text="LP内容に合った画像生成プロンプトを作成" position="bottom" className="w-full">
                  <button
                    onClick={() => setPromptAssistantOpen(true)}
                    className="w-full flex items-center justify-between py-2.5 px-4 bg-[#00AFCC] hover:bg-[#0099B3] text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      <span>🎨</span>
                      <span>AI画像プロンプト生成</span>
                    </span>
                    {savedPrompts.length > 0 && (
                      <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                        {savedPrompts.length}件保存
                      </span>
                    )}
                  </button>
                </Tooltip>
              </div>

              {/* カラーテーマ */}
              <Accordion
                title="カラーテーマ"
                defaultOpen
                badge={Object.values(colorReplacements).length > 0 ? String(Object.keys(colorReplacements).filter(k => colorReplacements[k] !== k).length) : undefined}
              >
                <ColorThemePicker
                  swatches={colorSwatches}
                  onPickStart={pushUndo}
                  onReplace={handleColorReplace}
                  onReset={handleColorReset}
                />
              </Accordion>

              {/* フォント */}
              <Accordion title="🔤 フォント">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">LP全体のフォント</label>
                    <select
                      value={globalFont}
                      onChange={(e) => {
                        pushUndo();
                        setGlobalFont(e.target.value);
                      }}
                      className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00AFCC] transition bg-white"
                    >
                      {FONT_OPTIONS.map((f) => (
                        <option key={f.id} value={f.id}>{f.label}</option>
                      ))}
                    </select>
                  </div>
                  {/* プレビューテキスト */}
                  <div
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 leading-relaxed"
                    style={{ fontFamily: FONT_OPTIONS.find(f => f.id === globalFont)?.cssFamily }}
                  >
                    <span className="text-base font-bold">見出しのサンプル</span><br />
                    <span>本文テキストのサンプルです。ABCDabcd 1234</span>
                  </div>
                  {FONT_OPTIONS.find(f => f.id === globalFont)?.googleFontsUrl && (
                    <p className="text-[10px] text-gray-400">Google Fonts から読み込みます（出力HTMLに自動追記）</p>
                  )}
                </div>
              </Accordion>

              {/* セクション追加 & 並び替え */}
              <Accordion title="セクション" defaultOpen>
                <div className="space-y-3">
                  <Tooltip text="テンプレートから新しいセクションを追加" position="bottom" className="w-full">
                    <button
                      onClick={() => setAddSectionOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-[#D8D8D2] hover:border-[#00AFCC] hover:bg-[#E6F8FC] text-[#00AFCC] font-semibold text-sm rounded-xl transition-colors"
                    >
                      <span className="text-lg leading-none">＋</span>
                      セクションを追加
                    </button>
                  </Tooltip>

                  {/* 吹き出し切り替え（お悩みセクションがある場合は常に表示） */}
                  {findProblemSectionId(sectionOrder) && (
                    <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                      <p className="text-[11px] font-bold text-indigo-700">💬 お悩みセクション レイアウト</p>
                      <div className="flex gap-1.5">
                        {(
                          [
                            { id: "normal" as const,  label: "📝 通常",   desc: "テキスト型" },
                            { id: "bubble" as const,  label: "💬 吹き出し", desc: "カード型"  },
                          ]
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            onClick={() => refProblemLayout !== opt.id && handleSwapProblemLayout()}
                            disabled={sectionSwapLoading || refProblemLayout === opt.id}
                            className={`flex-1 py-2 text-[11px] font-semibold rounded-lg border-2 transition-all disabled:cursor-not-allowed ${
                              refProblemLayout === opt.id
                                ? "bg-indigo-600 text-white border-indigo-600"
                                : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                            } ${sectionSwapLoading && refProblemLayout !== opt.id ? "opacity-50" : ""}`}
                          >
                            {sectionSwapLoading && refProblemLayout !== opt.id ? (
                              <span className="flex items-center justify-center gap-1">
                                <span className="w-3 h-3 border-2 border-current/40 border-t-current rounded-full animate-spin inline-block" />
                                生成中…
                              </span>
                            ) : (
                              <>
                                <div>{opt.label}</div>
                                <div className={`text-[9px] font-normal mt-0.5 ${refProblemLayout === opt.id ? "text-indigo-200" : "text-gray-400"}`}>{opt.desc}</div>
                              </>
                            )}
                          </button>
                        ))}
                      </div>
                      {sectionSwapError && (
                        <p className="text-[10px] text-red-600">{sectionSwapError}</p>
                      )}
                      <p className="text-[10px] text-indigo-500">切り替え後はUndoで元に戻せます</p>
                    </div>
                  )}

                  <SectionSorter
                    sections={sectionOrder}
                    onReorder={handleReorderByIndex}
                    onSectionClick={handleSectionClick}
                    activeSectionId={activeSectionId}
                    onSectionDelete={handleDeleteRequest}
                    protectedIds={protectedSectionIds}
                  />

                  {/* 固定要素（insertAtEnd / position:fixed など） */}
                  {fixedSections.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <p className="text-[10px] text-gray-400 mb-1.5">固定要素</p>
                      <ul className="space-y-1">
                        {fixedSections.map((sec) => (
                          <li
                            key={sec.id}
                            className="group flex items-center gap-2 px-2 py-2 rounded-lg border border-gray-100 bg-white text-xs"
                          >
                            <span className="text-gray-400">📌</span>
                            <span className="flex-1 font-medium text-gray-700 truncate">{sec.label}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteRequest(sec.id, sec.label)}
                              className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                              title={`「${sec.label}」を削除`}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14H6L5 6" />
                                <path d="M10 11v6M14 11v6" />
                                <path d="M9 6V4h6v2" />
                              </svg>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </Accordion>

              {/* 画像管理 */}
              <Accordion title="🖼 画像" defaultOpen>
                {/* テンプレ画像ギャラリー */}
                <div className="mb-3">
                  <Tooltip text="業種別テンプレ画像から選んで挿入" position="bottom" className="w-full">
                    <button
                      onClick={() => setGalleryOpen(true)}
                      className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-[#D8D8D2] hover:border-[#00AFCC] hover:bg-[#E6F8FC] text-gray-500 hover:text-[#00AFCC] font-semibold text-xs rounded-xl transition-colors"
                    >
                      <span>🖼</span>
                      テンプレ画像ギャラリー
                    </button>
                  </Tooltip>
                </div>
                <SectionImageManager
                  sectionOrder={sectionOrder}
                  images={images}
                  onImagesChange={handleImagesChange}
                  unsplashResult={unsplashResult}
                  unsplashLoading={unsplashLoading}
                  unsplashError={unsplashError}
                  onUnsplashFetch={handleUnsplashFetch}
                  onImageSelect={handleImageSelect}
                  onImageDeselect={handleImageDeselect}
                  serviceInfo={lastFormData ?? undefined}
                />
              </Accordion>

              {/* AI修正 */}
              <Accordion title="AI修正">
                <RevisionForm onRevise={handleRevise} loading={revisionLoading} />
                {revisionError && (
                  <div className="mt-2 bg-red-50 border border-red-100 rounded-xl p-3 space-y-2">
                    <p className="text-xs text-red-600 font-semibold">修正に失敗しました</p>
                    <p className="text-[11px] text-red-500">指示が複雑すぎた可能性があります。指示を短くシンプルにするか、そのまま再試行してください。</p>
                    {lastRevisionInstruction && (
                      <button
                        onClick={() => handleRevise(lastRevisionInstruction)}
                        disabled={revisionLoading}
                        className="w-full py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 border border-red-200 rounded-lg transition-colors"
                      >
                        🔄 同じ指示で再試行
                      </button>
                    )}
                  </div>
                )}
                {revisionLoading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-[#00AFCC] rounded-full animate-spin" />
                    修正中…
                  </div>
                )}
              </Accordion>

              {/* SEO */}
              <Accordion title="SEOチェック">
                <SEOChecker html={result.html} />
              </Accordion>

              {/* フォーム設定（Phase 6） */}
              <Accordion title="📋 フォーム・リード取得">
                <FormConfigPanel
                  projectId={remoteProjectId}
                  projectSlug={publishedSlug}
                  isPublished={!!publishedSlug}
                />
              </Accordion>

              {/* 入力情報・再生成 */}
              <Accordion title="📝 入力情報・再生成">
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">入力内容を修正して再生成できます。カラー・画像設定は引き継がれます。</p>
                  <LPForm
                    key={`regen-${regenFormKey}`}
                    onSubmit={handleRegenerate}
                    loading={loading}
                    importedValues={lastFormData ?? importedValues}
                  />
                  {loading && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-[#D8D8D2] border-t-[#00AFCC] rounded-full animate-spin" />
                      <span className="text-xs text-gray-500">
                        {retryMessage ?? "AI生成中…"}
                      </span>
                    </div>
                  )}
                  {error && (
                    <div className="text-xs text-red-600 bg-red-50 rounded p-2">{error}</div>
                  )}
                </div>
              </Accordion>

              {/* Note */}
              <div className="px-4 py-3 text-[11px] text-gray-400">
                お客様の声はサンプルです。実際の声に差し替えてご利用ください。
              </div>

              {/* Legal links */}
              <div className="px-4 pb-4 flex gap-3 text-[10px] text-gray-300">
                <a href="/terms" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">利用規約</a>
                <a href="/privacy" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">プライバシーポリシー</a>
              </div>
            </div>
          )}
        </aside>

        {/* ═══ RIGHT PANEL ═══ */}
        <main className="flex-1 flex flex-col overflow-hidden min-w-0">
          {!result ? (
            /* ── Before generation: placeholder ── */
            <div className="flex-1 flex items-center justify-center text-gray-300">
              <div className="text-center space-y-3">
                <div className="text-6xl">🖥️</div>
                <p className="text-sm">左のフォームを入力してLPを生成してください</p>
              </div>
            </div>
          ) : (
            /* ── After generation: tabs + preview ── */
            <>
              {/* Tab bar */}
              <div className="flex-shrink-0 flex items-center border-b border-gray-200 bg-white">
                <div className="flex flex-1 overflow-x-auto">
                  {RESULT_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border-b-2
                        ${activeTab === tab.id
                          ? "text-[#00AFCC] border-[#00AFCC] bg-[#E6F8FC]"
                          : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Toolbar: mode toggle + undo/redo */}
                <div className="flex items-center gap-1 px-3 shrink-0 border-l border-gray-100">
                  {activeTab === "preview" && (
                    <>
                      {/* Edit mode toggle */}
                      <div className="flex rounded-lg border border-gray-200 overflow-hidden mr-1">
                        <Tooltip text="テキストをクリックして直接編集" position="bottom">
                          <button
                            onClick={() => handleEditModeToggle("text")}
                            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "text" ? "bg-[#00AFCC] text-white" : "text-gray-500 hover:bg-[#E6F8FC] hover:text-[#00AFCC]"}`}
                          >✏ テキスト</button>
                        </Tooltip>
                        <Tooltip text="要素の色・背景・余白を編集" position="bottom">
                          <button
                            onClick={() => handleEditModeToggle("style")}
                            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "style" ? "bg-[#00AFCC] text-white" : "text-gray-500 hover:bg-[#E6F8FC] hover:text-[#00AFCC]"}`}
                          >🎨 スタイル</button>
                        </Tooltip>
                        <Tooltip text="クリックした要素に画像を挿入" position="bottom">
                          <button
                            onClick={() => handleEditModeToggle("image")}
                            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "image" ? "bg-[#00AFCC] text-white" : "text-gray-500 hover:bg-[#E6F8FC] hover:text-[#00AFCC]"}`}
                          >📷 画像</button>
                        </Tooltip>
                      </div>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                      <Tooltip text="デスクトップ表示でプレビュー" position="bottom">
                        <button
                          onClick={() => setPreviewMode("desktop")}
                          className={`p-1.5 rounded text-sm transition-colors ${previewMode === "desktop" ? "bg-[#E6F8FC] text-[#00AFCC]" : "text-gray-400 hover:text-[#00AFCC]"}`}
                        >🖥️</button>
                      </Tooltip>
                      <Tooltip text="スマートフォン表示でプレビュー" position="bottom">
                        <button
                          onClick={() => setPreviewMode("mobile")}
                          className={`p-1.5 rounded text-sm transition-colors ${previewMode === "mobile" ? "bg-[#E6F8FC] text-[#00AFCC]" : "text-gray-400 hover:text-[#00AFCC]"}`}
                        >📱</button>
                      </Tooltip>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                    </>
                  )}
                  <Tooltip text={`元に戻す (Ctrl+Z)${undoStack.length > 0 ? ` — ${undoStack.length}件` : ""}`} position="bottom">
                    <button
                      onClick={handleUndo}
                      disabled={undoStack.length === 0}
                      className="p-1.5 rounded text-sm text-gray-400 hover:text-[#00AFCC] hover:bg-[#E6F8FC] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                    >↩</button>
                  </Tooltip>
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === "preview" && (
                  <div className="h-full flex flex-col">
                    <div className="px-3 py-1.5 flex items-center gap-1.5 bg-white border-b border-gray-100 flex-shrink-0">
                      {editMode === "text" ? (
                        <span className="text-[11px] text-[#00AFCC] font-medium">✏ テキストをクリックして直接編集</span>
                      ) : editMode === "image" ? (
                        <span className="text-[11px] text-[#00AFCC] font-medium">
                          📷 要素をクリックして画像を挿入
                          {selectedElement && (
                            <span className="ml-2 text-[#00AFCC]">
                              — {selectedElement.label || selectedElement.selector}
                            </span>
                          )}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[#00AFCC] font-medium">
                          🎨 要素をクリックしてスタイルを編集
                          {selectedElement && (
                            <span className="ml-2 text-[#00AFCC]">
                              — {selectedElement.label || selectedElement.selector}
                            </span>
                          )}
                        </span>
                      )}
                      {undoStack.length > 0 && (
                        <span className="text-[10px] text-gray-400 ml-auto">
                          ↩{undoStack.length}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto bg-[#F5F5F2]">
                      <LPPreview
                        ref={previewRef}
                        html={result.html}
                        css={effectiveCss}
                        mode={previewMode}
                        imageOverrides={images}
                        onHtmlChange={handleHtmlChange}
                        onHtmlSilentUpdate={(html) => applyHtml(html, false)}
                        iframeHeight={750}
                        editMode={editMode === "image" ? "style" : editMode}
                        onElementSelect={handleElementSelect}
                        selectedSelector={selectedElement?.selector ?? null}
                        buttonImageOverrides={buttonImageOverrides}
                        fontGoogleUrl={fontGoogleUrl}
                        fontFamily={fontFamily}
                      />
                    </div>
                  </div>
                )}
                {activeTab === "html" && (
                  <div className="relative p-4">
                    {planType && planType !== "pro" && (
                      <LockScreen
                        featureTitle="HTMLエクスポート"
                        onUpgrade={() => openUpgrade("HTMLエクスポートはProプランの機能です。")}
                      />
                    )}
                    <CodeBlock
                      label="WordPressカスタムHTMLブロックに貼り付け"
                      code={buttonProcessedHtml}
                      language="html"
                    />
                  </div>
                )}
                {activeTab === "css" && (
                  <div className="relative p-4">
                    {planType && planType !== "pro" && (
                      <LockScreen
                        featureTitle="CSSエクスポート"
                        onUpgrade={() => openUpgrade("CSSエクスポートはProプランの機能です。")}
                      />
                    )}
                    <CodeBlock
                      label={`WordPress「追加CSS」に貼り付け${images.length > 0 || Object.keys(colorReplacements).length > 0 ? "（カスタマイズ反映済み）" : ""}`}
                      code={effectiveCss}
                      language="css"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* ═══ RIGHT PANEL — Image Insert ═══ */}
        {result && editMode === "image" && (
          <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-end shrink-0">
              <a
                href="/assets"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#00AFCC] hover:underline font-semibold"
              >
                📁 アセットライブラリ →
              </a>
            </div>
            <ImageInsertPanel
              selectedElement={selectedElement}
              html={result.html}
              onUpdate={(newHtml) => applyHtml(newHtml, true)}
              onDeselect={() => setSelectedElement(null)}
            />
          </aside>
        )}

        {/* ═══ RIGHT PANEL — Visual Style Editor ═══ */}
        {result && editMode === "style" && selectedElement &&
          !selectedElement.selector.endsWith(".lp-freeblock") &&
          !selectedElement.selector.includes(".lp-customhtml") && (
          <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
            <VisualStylePanel
              element={selectedElement}
              currentRule={visualStyles[selectedElement.selector] ?? { styles: {} }}
              onUpdate={handleStyleUpdate}
              onDeselect={() => setSelectedElement(null)}
              onDelete={() => {
                pushUndo();
                const newHtml = deleteElementFromHtml(
                  result.html,
                  selectedElement.elementId,
                  selectedElement.selector,
                );
                applyHtml(newHtml, false);
                setSelectedElement(null);
              }}
              effectiveCss={effectiveCss}
              onSelectSection={(lpClasses) => previewRef.current?.selectSection(lpClasses)}
            />
          </aside>
        )}

        {/* ═══ RIGHT PANEL — Free Block Editor ═══ */}
        {result && editMode === "style" && selectedElement?.selector.endsWith(".lp-freeblock") && (
          <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
            <FreeBlockPanel
              selector={selectedElement.selector}
              html={result.html}
              onUpdate={(newHtml) => {
                pushUndo();
                applyHtml(newHtml, false);
              }}
            />
          </aside>
        )}

        {/* ═══ RIGHT PANEL — Custom HTML Editor ═══ */}
        {result && editMode === "style" && selectedElement?.selector.includes(".lp-customhtml") && (
          <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
            <CustomHtmlPanel
              selector={selectedElement.selector}
              html={result.html}
              onUpdate={(newHtml) => {
                pushUndo();
                applyHtml(newHtml, false);
              }}
              onDeselect={() => setSelectedElement(null)}
            />
          </aside>
        )}

        {/* Style mode hint when no element selected */}
        {result && editMode === "style" && !selectedElement && (
          <aside className="w-64 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
            <div className="flex items-center justify-end px-3 py-2 border-b border-gray-100 shrink-0">
              <button
                onClick={() => setEditMode("text")}
                className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors text-sm"
              >✕</button>
            </div>
            <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[#E6F8FC] flex items-center justify-center text-2xl">
                🎨
              </div>
              <div>
                <p className="text-sm font-bold text-gray-700">スタイル編集モード</p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  プレビュー内の要素をクリックすると、ここに編集パネルが表示されます
                </p>
              </div>
              <div className="text-left w-full space-y-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
                {[
                  { icon: "H", text: "見出し — フォント・色・影" },
                  { icon: "¶", text: "本文 — サイズ・行間・色" },
                  { icon: "▶", text: "ボタン — 4タブで詳細編集" },
                  { icon: "▥", text: "カード — 背景・枠線・影・余白" },
                  { icon: "▣", text: "セクション — 背景・余白" },
                  { icon: "⬜", text: "画像 — 幅・角丸・枠線" },
                ].map((item) => (
                  <div key={item.text} className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-[#E6F8FC] text-[#00AFCC] text-[10px] font-bold flex items-center justify-center shrink-0">
                      {item.icon}
                    </span>
                    <span>{item.text}</span>
                  </div>
                ))}
              </div>
              {Object.keys(visualStyles).length > 0 && (
                <button
                  onClick={() => setVisualStyles({})}
                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                >
                  全スタイルをリセット ({Object.keys(visualStyles).length}件)
                </button>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ─── セクション削除 確認モーダル ─────────────────────────────────── */}
      {deletingSection && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm"
          onClick={(e) => { if (e.target === e.currentTarget) setDeletingSection(null); }}
        >
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">🗑️</span>
              <h3 className="font-bold text-gray-900 text-base">セクションを削除</h3>
            </div>
            <p className="text-sm text-gray-600 mb-1">
              <span className="font-semibold text-gray-900">「{deletingSection.label}」</span>を削除しますか？
            </p>
            <p className="text-xs text-gray-400 mb-6">削除後は Ctrl+Z / 元に戻すボタンで復元できます。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeletingSection(null)}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                キャンセル
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-sm font-semibold text-white transition-colors shadow-sm"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
