"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import LPForm from "@/components/LPForm";
import LPPreview, { LPPreviewHandle } from "@/components/LPPreview";
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
import { LPFormData, GeneratedLP, UploadedImage, PreviewMode, UnsplashResult, SavedImagePrompt, SelectedElement, VisualStyles, StyleRule } from "@/types";
import { SECTION_TEMPLATES } from "@/lib/sectionTemplates";
import { buildVisualCss } from "@/lib/visualStyles";
import { extractSectionLabel } from "@/lib/sectionLabel";
import {
  LPProject, ProjectSnapshot,
  buildProject, saveToLocal, loadFromLocal, clearLocal,
  downloadProject, parseProjectFile, formatSavedAt,
  serializeImages, serializeImagesSync, deserializeImages,
} from "@/lib/project";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultTab = "preview" | "html" | "css" | "netlify";
type InputMethod = "form" | "url" | "text" | "ref";
type EditMode = "text" | "style";

/** Undo スナップショット — HTML・セクション順・スタイルをまとめて保存 */
type UndoSnapshot = {
  html: string;
  sectionOrder: SortableSection[];
  visualStyles: VisualStyles;
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
  onRetry: (message: string) => void
): Promise<GeneratedLP> {
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
 * placement が "other" の場合は汎用ラッパー、それ以外は `.lp-{placement}` を使用。
 * sectionOrder がどう変わっても LP の lp-* クラスに確実にマッチする。
 */
function buildImageCss(images: UploadedImage[]): string {
  return images
    .map((img) => {
      const sel = img.placement === "other" ? ".lp-wrapper" : `.lp-${img.placement}`;
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

function buildNetlifyHtml(html: string, css: string, serviceName: string, unsplashImages: UploadedImage[]): string {
  const attrComments = unsplashImages
    .filter((img) => img.attribution)
    .map((img) => `<!-- Photo by ${img.attribution!.photographerName} on Unsplash -->`)
    .join("\n");
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="${serviceName}のランディングページ" />
  <title>${serviceName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
  <style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Noto Sans JP', sans-serif; }
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

  // ── Input method ──
  const [inputMethod, setInputMethod] = useState<InputMethod>("form");
  const [importedValues, setImportedValues] = useState<Partial<LPFormData> | undefined>(undefined);
  // ヒアリングシート貼り付け
  const [hearingText, setHearingText] = useState("");
  const [hearingLoading, setHearingLoading] = useState(false);
  const [hearingError, setHearingError] = useState<string | null>(null);

  // ── Project save / load ──
  const [savedProject, setSavedProject] = useState<LPProject | null>(null);
  const [showRestoreBanner, setShowRestoreBanner] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadFileRef = useRef<HTMLInputElement>(null);

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

  // ── Section navigation（サイドバークリック → プレビュースクロール）──
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const previewRef = useRef<LPPreviewHandle>(null);

  // refs：applyHtml の useCallback 内で最新値を参照するため（deps に加えない）
  const sectionOrderRef = useRef<SortableSection[]>([]);
  sectionOrderRef.current = sectionOrder;
  const visualStylesRef = useRef<VisualStyles>({});
  visualStylesRef.current = visualStyles;

  // ── Add section ──
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  // ── Delete section ──
  const [deletingSection, setDeletingSection] = useState<{ id: string; label: string } | null>(null);

  // ── 入力情報フォームのリセットキー（再生成のたびにインクリメントして最新値を反映）──
  const [regenFormKey, setRegenFormKey] = useState(0);

  // ── Image prompt assistant ──
  const [promptAssistantOpen, setPromptAssistantOpen] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedImagePrompt[]>([]);
  /** templateId → css （型ごとに1度だけ追加） */
  const [additionalCssByType, setAdditionalCssByType] = useState<Record<string, string>>({});

  // ─── Derived CSS ──────────────────────────────────────────────────────────

  const additionalCss = Object.values(additionalCssByType).join("\n");

  const effectiveCss = useMemo(() => {
    if (!result) return "";
    let css = replaceColors(result.css, colorReplacements);
    if (additionalCss) css += "\n/* 追加セクション */\n" + additionalCss;
    const imgCss = buildImageCss(images);
    if (imgCss) css += "\n/* 画像オーバーライド */\n" + imgCss;
    const visualCss = buildVisualCss(visualStyles);
    if (visualCss) css += "\n" + visualCss;
    return css;
  }, [result, colorReplacements, additionalCss, images, visualStyles]);

  const extractedColors = useMemo(() => {
    if (!result?.css) return [];
    return extractTopColors(result.css);
  }, [result?.css]);

  const colorSwatches = useMemo(
    () => extractedColors.map((orig) => ({ original: orig, current: colorReplacements[orig] ?? orig })),
    [extractedColors, colorReplacements]
  );

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
  }, [undoStack]);

  // ─── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async (data: LPFormData) => {
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
    setServiceName(data.serviceName);
    setLastFormData(data);
    setUnsplashResult(null);
    try {
      const generated = await generateWithRetry(data, (msg) => setRetryMessage(msg));
      setResult(generated);
      setSectionOrder(parseSectionOrder(generated.html));
      setActiveTab("preview");
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
      const generated = await generateWithRetry(data, (msg) => setRetryMessage(msg));
      setResult(generated);
      setSectionOrder(parseSectionOrder(generated.html));
      setActiveTab("preview");
      setRegenFormKey((k) => k + 1); // フォームを最新データで再初期化
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
    setRevisionLoading(true);
    setRevisionError(null);
    setUndoStack([]);
    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: result.html, css: result.css, instruction }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "修正に失敗しました");
      setResult(json as GeneratedLP);
      setSectionOrder(parseSectionOrder((json as GeneratedLP).html));
      setActiveTab("preview");
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
    // CSS は型ごとに1度だけ
    setAdditionalCssByType((prev) => ({ ...prev, [templateId]: css }));
    // SectionSorter に追加（fixedcta は並び替え対象外）
    if (!template?.insertAtEnd) {
      setSectionOrder((prev) => {
        if (prev.some((s) => s.id === templateId)) return prev;
        const meta = SECTION_META[templateId] ?? templateId;
        // CTA の前に挿入
        const ctaIdx = prev.findIndex((s) => s.id === "cta");
        const next = [...prev];
        next.splice(ctaIdx >= 0 ? ctaIdx : next.length, 0, { id: templateId, label: meta });
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

  const handleSectionReorder = (newOrder: string[]) => {
    if (!result) return;
    const reordered = reorderHtmlSections(result.html, newOrder);
    // ラベルは現在の sectionOrder から引き継ぐ（SECTION_META 外のIDも正しく表示）
    const labelMap = new Map(sectionOrder.map((s) => [s.id, s.label]));
    const nextSections = newOrder
      .filter((id) => labelMap.has(id))
      .map((id) => ({ id, label: labelMap.get(id) ?? SECTION_META[id] ?? id }));
    setSectionOrder(nextSections);
    applyHtml(reordered, true);
  };

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
    setImages((prev) => [
      ...prev.filter((img) => !(img.placement === image.placement && img.attribution)),
      image,
    ]);
  };

  const handleImageDeselect = (placement: string) => {
    setImages((prev) => prev.filter((img) => !(img.placement === placement && img.attribution)));
  };

  // ─── Visual style update ──────────────────────────────────────────────────

  const handleStyleUpdate = (selector: string, rule: StyleRule) => {
    pushUndo();
    setVisualStyles((prev) => ({ ...prev, [selector]: rule }));
  };

  const handleElementSelect = (el: SelectedElement | null) => {
    setSelectedElement(el);
  };

  const handleEditModeToggle = (mode: EditMode) => {
    setEditMode(mode);
    if (mode === "text") setSelectedElement(null);
  };

  // ─── Project: apply（復元・読み込み共通）────────────────────────────────────

  const applyProject = useCallback((project: LPProject) => {
    // セクション順序は保存データから復元するが、ラベルは HTML 再スキャンで上書きする
    // （useEffect [result?.html] が発火してラベルを最新化する）
    // ID だけ保持した順序データを先にセットしておく
    setSectionOrder(project.sectionOrder.map((s) => ({ id: s.id, label: s.id })));
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
  }, []);

  // ─── Project: ローカル保存（同期・高速）──────────────────────────────────────

  const handleSaveLocal = () => {
    if (!result || !lastFormData) return;
    const snap: ProjectSnapshot = {
      formData: lastFormData,
      html: result.html, css: result.css,
      colorReplacements, visualStyles, sectionOrder, additionalCssByType,
      images: serializeImagesSync(images),
    };
    const project = buildProject(snap);
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
      const project = buildProject(snap);
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
  };

  // ─── Ref LP complete ──────────────────────────────────────────────────────

  const handleRefComplete = (generated: GeneratedLP, formData: LPFormData) => {
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
  };

  // ─── Site importer ────────────────────────────────────────────────────────

  const handleSiteDataApply = (data: Partial<LPFormData>) => {
    setImportedValues(data);
    setInputMethod("form");
  };

  // ─── Hearing sheet analyzer ───────────────────────────────────────────────

  const handleHearingAnalyze = async () => {
    if (!hearingText.trim()) return;
    setHearingLoading(true);
    setHearingError(null);
    try {
      const res = await fetch("/api/analyze-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: hearingText.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "解析に失敗しました");
      const { serviceName, industry, target, area, serviceDetail, price, strengths, designMood, ctaType, ctaLink } = json;
      const ct = (["line", "phone", "contact"].includes(ctaType) ? ctaType : "contact") as "line" | "phone" | "contact";
      setImportedValues({ serviceName, industry, target, area, serviceDetail, price, strengths, designMood, ctaType: ct, ctaLink });
      setInputMethod("form");
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
    if (p) { setSavedProject(p); setShowRestoreBanner(true); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Project: auto-save（2秒デバウンス、LP 生成後のみ）────────────────────

  useEffect(() => {
    if (!result || !lastFormData) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      const snap: ProjectSnapshot = {
        formData: lastFormData,
        html: result.html,
        css: result.css,
        colorReplacements,
        visualStyles,
        sectionOrder,
        additionalCssByType,
        images: serializeImagesSync(images),
      };
      saveToLocal(buildProject(snap));
    }, 2000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, lastFormData, colorReplacements, visualStyles, sectionOrder, additionalCssByType, images]);

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const RESULT_TABS: { id: ResultTab; label: string }[] = [
    { id: "preview", label: "プレビュー" },
    { id: "html", label: "HTML" },
    { id: "css", label: "CSS" },
    { id: "netlify", label: "Netlify" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#F5F5F2]">
      <AddSectionModal
        open={addSectionOpen}
        onClose={() => setAddSectionOpen(false)}
        onAdd={handleAddSection}
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
          <div className="flex-1 min-w-0">
            <h1 className="text-[15px] font-black text-gray-900 leading-tight tracking-[0.15em]">AI LP STUDIO</h1>
          </div>

          {/* ── 保存・読み込みボタン ── */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* 読み込む（常時表示） */}
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

            {/* 保存（LP 生成後のみ） */}
            {result && (
              <div className="relative">
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
                {saveMenuOpen && (
                  <>
                    {/* オーバーレイ（メニュー外クリックで閉じる） */}
                    <div className="fixed inset-0 z-40" onClick={() => setSaveMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl py-1 z-50 min-w-[180px]">
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

            {result && (
              <div className="hidden sm:flex items-center gap-1.5">
                <span className="text-xs text-gray-400">AI生成完了</span>
                <span className="w-2 h-2 rounded-full bg-green-400" />
              </div>
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
                    { id: "form", label: "✏ フォーム" },
                    { id: "url",  label: "🌐 URL" },
                    { id: "text", label: "📋 貼付" },
                    { id: "ref",  label: "🔍 参考LP" },
                  ] as { id: InputMethod; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setInputMethod(tab.id)}
                    className={`flex-1 py-2.5 text-[11px] font-semibold transition-colors border-b-2
                      ${inputMethod === tab.id
                        ? "text-[#00AFCC] border-[#00AFCC] bg-[#E6F8FC]"
                        : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {tab.label}
                  </button>
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
              </div>

              {/* カラーテーマ */}
              <Accordion
                title="カラーテーマ"
                defaultOpen
                badge={Object.values(colorReplacements).length > 0 ? String(Object.keys(colorReplacements).filter(k => colorReplacements[k] !== k).length) : undefined}
              >
                <ColorThemePicker
                  swatches={colorSwatches}
                  onReplace={(orig, next) =>
                    setColorReplacements((prev) => ({ ...prev, [orig]: next }))
                  }
                  onReset={() => setColorReplacements({})}
                />
              </Accordion>

              {/* セクション追加 & 並び替え */}
              <Accordion title="セクション" defaultOpen>
                <div className="space-y-3">
                  <button
                    onClick={() => setAddSectionOpen(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-[#D8D8D2] hover:border-[#00AFCC] hover:bg-[#E6F8FC] text-[#00AFCC] font-semibold text-sm rounded-xl transition-colors"
                  >
                    <span className="text-lg leading-none">＋</span>
                    セクションを追加
                  </button>
                  <SectionSorter
                    sections={sectionOrder}
                    onChange={handleSectionReorder}
                    onSectionClick={handleSectionClick}
                    activeSectionId={activeSectionId}
                    onSectionDelete={handleDeleteRequest}
                    protectedIds={protectedSectionIds}
                  />
                </div>
              </Accordion>

              {/* 画像管理 */}
              <Accordion title="🖼 画像" defaultOpen>
                <SectionImageManager
                  sectionOrder={sectionOrder}
                  images={images}
                  onImagesChange={setImages}
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
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{revisionError}</div>
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
                        <button
                          onClick={() => handleEditModeToggle("text")}
                          title="テキスト編集モード"
                          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "text" ? "bg-[#00AFCC] text-white" : "text-gray-500 hover:bg-[#E6F8FC] hover:text-[#00AFCC]"}`}
                        >✏ テキスト</button>
                        <button
                          onClick={() => handleEditModeToggle("style")}
                          title="スタイル編集モード"
                          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "style" ? "bg-[#00AFCC] text-white" : "text-gray-500 hover:bg-[#E6F8FC] hover:text-[#00AFCC]"}`}
                        >🎨 スタイル</button>
                      </div>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                      <button
                        onClick={() => setPreviewMode("desktop")}
                        title="デスクトップ"
                        className={`p-1.5 rounded text-sm transition-colors ${previewMode === "desktop" ? "bg-[#E6F8FC] text-[#00AFCC]" : "text-gray-400 hover:text-[#00AFCC]"}`}
                      >🖥️</button>
                      <button
                        onClick={() => setPreviewMode("mobile")}
                        title="モバイル"
                        className={`p-1.5 rounded text-sm transition-colors ${previewMode === "mobile" ? "bg-[#E6F8FC] text-[#00AFCC]" : "text-gray-400 hover:text-[#00AFCC]"}`}
                      >📱</button>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                    </>
                  )}
                  <button
                    onClick={handleUndo}
                    disabled={undoStack.length === 0}
                    title={`元に戻す (Ctrl+Z)${undoStack.length > 0 ? ` — ${undoStack.length}件` : ""}`}
                    className="p-1.5 rounded text-sm text-gray-400 hover:text-[#00AFCC] hover:bg-[#E6F8FC] disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >↩</button>
                  {activeTab === "netlify" && (
                    <>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                      <button
                        onClick={() => downloadFile(
                          buildNetlifyHtml(result.html, effectiveCss, serviceName, unsplashImages),
                          `${serviceName || "lp"}.html`,
                          "text/html"
                        )}
                        className="text-xs px-3 py-1.5 bg-[#00AFCC] hover:bg-[#0099B3] text-white rounded-lg font-semibold transition-colors"
                      >
                        DL
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto">
                {activeTab === "preview" && (
                  <div className="h-full flex flex-col">
                    <div className="px-3 py-1.5 flex items-center gap-1.5 bg-white border-b border-gray-100 flex-shrink-0">
                      {editMode === "text" ? (
                        <span className="text-[11px] text-[#00AFCC] font-medium">✏ テキストをクリックして直接編集</span>
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
                        iframeHeight={750}
                        editMode={editMode}
                        onElementSelect={handleElementSelect}
                        selectedSelector={selectedElement?.selector ?? null}
                      />
                    </div>
                  </div>
                )}
                {activeTab === "html" && (
                  <div className="p-4">
                    <CodeBlock
                      label="WordPressカスタムHTMLブロックに貼り付け"
                      code={result.html}
                      language="html"
                    />
                  </div>
                )}
                {activeTab === "css" && (
                  <div className="p-4">
                    <CodeBlock
                      label={`WordPress「追加CSS」に貼り付け${images.length > 0 || Object.keys(colorReplacements).length > 0 ? "（カスタマイズ反映済み）" : ""}`}
                      code={effectiveCss}
                      language="css"
                    />
                  </div>
                )}
                {activeTab === "netlify" && (
                  <div className="p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      HTML・CSSを1ファイルに統合。Netlify / GitHub Pages などに直接デプロイできます。
                    </p>
                    <CodeBlock
                      label="完全なHTMLファイル（Netlify / GitHub Pages 用）"
                      code={buildNetlifyHtml(result.html, effectiveCss, serviceName, unsplashImages)}
                      language="html"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </main>

        {/* ═══ RIGHT PANEL — Visual Style Editor ═══ */}
        {result && editMode === "style" && selectedElement && (
          <aside className="w-72 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
            <VisualStylePanel
              element={selectedElement}
              currentRule={visualStyles[selectedElement.selector] ?? { styles: {} }}
              onUpdate={handleStyleUpdate}
              onDeselect={() => setSelectedElement(null)}
            />
          </aside>
        )}

        {/* Style mode hint when no element selected */}
        {result && editMode === "style" && !selectedElement && (
          <aside className="w-64 shrink-0 flex flex-col bg-white border-l border-gray-200 overflow-hidden z-10">
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
