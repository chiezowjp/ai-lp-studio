"use client";

import { useState, useMemo, useCallback } from "react";
import LPForm from "@/components/LPForm";
import LPPreview from "@/components/LPPreview";
import CodeBlock from "@/components/CodeBlock";
import RevisionForm from "@/components/RevisionForm";
import ImageUploader from "@/components/ImageUploader";
import SEOChecker from "@/components/SEOChecker";
import UnsplashPicker from "@/components/UnsplashPicker";
import ColorThemePicker from "@/components/ColorThemePicker";
import SectionSorter, { SortableSection } from "@/components/SectionSorter";
import AddSectionModal from "@/components/AddSectionModal";
import ImagePromptAssistant from "@/components/ImagePromptAssistant";
import SiteImporter from "@/components/SiteImporter";
import VisualStylePanel from "@/components/VisualStylePanel";
import LPRefAnalyzer from "@/components/LPRefAnalyzer";
import ImageDirector from "@/components/ImageDirector";
import { LPFormData, GeneratedLP, UploadedImage, PreviewMode, ImagePlacement, UnsplashResult, SavedImagePrompt, SelectedElement, VisualStyles, StyleRule } from "@/types";
import { SECTION_TEMPLATES } from "@/lib/sectionTemplates";
import { buildVisualCss } from "@/lib/visualStyles";

// ─── Types ───────────────────────────────────────────────────────────────────

type ResultTab = "preview" | "html" | "css" | "netlify";
type InputMethod = "form" | "url" | "text" | "ref" | "image";
type EditMode = "text" | "style";

// ─── Constants ───────────────────────────────────────────────────────────────

const RETRY_DELAYS = [2000, 5000, 10000];

const PLACEMENT_CSS: Record<ImagePlacement, string> = {
  hero: ".lp-hero",
  service: ".lp-service",
  testimonial: ".lp-testimonial",
  other: ".lp-wrapper",
};

const SECTION_META: Record<string, string> = {
  // AI生成セクション
  hero: "ファーストビュー",
  problem: "お悩み",
  reason: "選ばれる理由",
  service: "サービス内容",
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

function buildImageCss(images: UploadedImage[]): string {
  return images
    .map((img) => {
      const sel = PLACEMENT_CSS[img.placement];
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

/** HTML からセクション順を検出 */
function parseSectionOrder(html: string): SortableSection[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  return Object.entries(SECTION_META)
    .filter(([id]) => doc.querySelector(`.lp-${id}`))
    .map(([id, label]) => ({ id, label }));
}

/** セクション並び替え後の HTML を再構築 */
function reorderHtmlSections(html: string, newOrder: string[]): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sectionEls = new Map<string, Element>();
  for (const id of Object.keys(SECTION_META)) {
    const el = doc.querySelector(`.lp-${id}`);
    if (el) sectionEls.set(id, el);
  }
  const firstEl = sectionEls.values().next().value;
  if (!firstEl) return html;
  const parent = (firstEl as Element).parentElement;
  if (!parent) return html;

  const sectionSet = new Set(sectionEls.values());
  const before: Element[] = [];
  const after: Element[] = [];
  let passedSections = false;
  for (const child of Array.from(parent.children)) {
    if (sectionSet.has(child)) { passedSections = true; continue; }
    if (!passedSections) before.push(child);
    else after.push(child);
  }
  parent.innerHTML = "";
  for (const el of before) parent.appendChild(el);
  for (const id of newOrder) {
    const el = sectionEls.get(id);
    if (el) parent.appendChild(el);
  }
  for (const el of after) parent.appendChild(el);
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
          {badge && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">{badge}</span>}
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

  // ── Undo / Redo ──
  const [htmlHistory, setHtmlHistory] = useState<string[]>([]);
  const [htmlFuture, setHtmlFuture] = useState<string[]>([]);

  // ── Images ──
  const [images, setImages] = useState<UploadedImage[]>([]);
  const [unsplashResult, setUnsplashResult] = useState<UnsplashResult | null>(null);
  const [unsplashLoading, setUnsplashLoading] = useState(false);
  const [unsplashError, setUnsplashError] = useState<string | null>(null);

  // ── Color theme ──
  const [colorReplacements, setColorReplacements] = useState<Record<string, string>>({});

  // ── Section order ──
  const [sectionOrder, setSectionOrder] = useState<SortableSection[]>([]);

  // ── Add section ──
  const [addSectionOpen, setAddSectionOpen] = useState(false);

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

  // ─── HTML change + Undo / Redo ────────────────────────────────────────────

  const applyHtml = useCallback((newHtml: string, saveHistory = true) => {
    setResult((prev) => {
      if (!prev) return prev;
      if (saveHistory) {
        setHtmlHistory((h) => [...h.slice(-29), prev.html]);
        setHtmlFuture([]);
      }
      return { ...prev, html: newHtml };
    });
  }, []);

  const handleHtmlChange = useCallback((newHtml: string) => applyHtml(newHtml, true), [applyHtml]);

  const handleUndo = () => {
    if (!result || htmlHistory.length === 0) return;
    const prev = htmlHistory[htmlHistory.length - 1];
    setHtmlHistory((h) => h.slice(0, -1));
    setHtmlFuture((f) => [result.html, ...f]);
    setResult((r) => (r ? { ...r, html: prev } : r));
  };

  const handleRedo = () => {
    if (!result || htmlFuture.length === 0) return;
    const next = htmlFuture[0];
    setHtmlFuture((f) => f.slice(1));
    setHtmlHistory((h) => [...h, result.html]);
    setResult((r) => (r ? { ...r, html: next } : r));
  };

  // ─── Generate ─────────────────────────────────────────────────────────────

  const handleGenerate = async (data: LPFormData) => {
    setLoading(true);
    setError(null);
    setResult(null);
    setRetryMessage(null);
    setHtmlHistory([]);
    setHtmlFuture([]);
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

  // ─── Revise ───────────────────────────────────────────────────────────────

  const handleRevise = async (instruction: string) => {
    if (!result) return;
    setRevisionLoading(true);
    setRevisionError(null);
    setHtmlHistory([]);
    setHtmlFuture([]);
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

  // ─── Section reorder ──────────────────────────────────────────────────────

  const handleSectionReorder = (newOrder: string[]) => {
    if (!result) return;
    const reordered = reorderHtmlSections(result.html, newOrder);
    const nextSections = newOrder
      .map((id) => ({ id, label: SECTION_META[id] ?? id }))
      .filter((s) => sectionOrder.some((x) => x.id === s.id));
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

  const handleImageDeselect = (placement: ImagePlacement) => {
    setImages((prev) => prev.filter((img) => !(img.placement === placement && img.attribution)));
  };

  // ─── Visual style update ──────────────────────────────────────────────────

  const handleStyleUpdate = (selector: string, rule: StyleRule) => {
    setVisualStyles((prev) => ({ ...prev, [selector]: rule }));
  };

  const handleElementSelect = (el: SelectedElement | null) => {
    setSelectedElement(el);
  };

  const handleEditModeToggle = (mode: EditMode) => {
    setEditMode(mode);
    if (mode === "text") setSelectedElement(null);
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
    setHtmlHistory([]);
    setHtmlFuture([]);
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

  // ─── Tab definitions ──────────────────────────────────────────────────────

  const RESULT_TABS: { id: ResultTab; label: string }[] = [
    { id: "preview", label: "プレビュー" },
    { id: "html", label: "HTML" },
    { id: "css", label: "CSS" },
    { id: "netlify", label: "Netlify" },
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-gray-50">
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
      <header className="flex-shrink-0 bg-white border-b border-gray-200 shadow-sm z-20">
        <div className="px-4 h-14 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
            LP
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-bold text-gray-900 leading-tight">LP自動生成ツール</h1>
          </div>
          {result && (
            <div className="flex items-center gap-2 shrink-0">
              <span className="hidden sm:inline text-xs text-gray-400">AI生成完了</span>
              <span className="w-2 h-2 rounded-full bg-green-400" />
            </div>
          )}
        </div>
      </header>

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
                    { id: "form",  label: "✏ フォーム" },
                    { id: "url",   label: "🌐 URL" },
                    { id: "text",  label: "📋 貼付" },
                    { id: "ref",   label: "🔍 参考LP" },
                    { id: "image", label: "📸 画像" },
                  ] as { id: InputMethod; label: string }[]
                ).map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setInputMethod(tab.id)}
                    className={`flex-1 py-2.5 text-[10px] font-semibold transition-colors border-b-2
                      ${inputMethod === tab.id
                        ? "text-indigo-600 border-indigo-600 bg-indigo-50"
                        : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50"
                      }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
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

                {/* ── 画像ディレクション ── */}
                {inputMethod === "image" && (
                  <ImageDirector
                    serviceInfo={lastFormData ?? importedValues ?? undefined}
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
                      className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                    />
                    {hearingError && (
                      <p className="text-xs text-red-600 bg-red-50 rounded p-2">{hearingError}</p>
                    )}
                    <button
                      onClick={handleHearingAnalyze}
                      disabled={!hearingText.trim() || hearingLoading}
                      className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2"
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
                    <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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

              {/* 画像ディレクション */}
              <Accordion title="📸 画像ディレクション" defaultOpen={false}>
                <ImageDirector serviceInfo={lastFormData ?? undefined} />
              </Accordion>

              {/* 画像生成プロンプト */}
              <div className="px-4 py-3 border-b border-gray-100">
                <button
                  onClick={() => setPromptAssistantOpen(true)}
                  className="w-full flex items-center justify-between py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold text-sm rounded-xl transition-all shadow-sm"
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
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-indigo-300 hover:border-indigo-500 hover:bg-indigo-50 text-indigo-600 font-semibold text-sm rounded-xl transition-colors"
                  >
                    <span className="text-lg leading-none">＋</span>
                    セクションを追加
                  </button>
                  <SectionSorter sections={sectionOrder} onChange={handleSectionReorder} />
                </div>
              </Accordion>

              {/* 画像 */}
              <Accordion title="画像">
                <div className="space-y-4">
                  <ImageUploader images={images} onChange={setImages} />
                  <div className="border-t border-gray-100 pt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-gray-700">Unsplash 画像提案</span>
                      <button
                        onClick={handleUnsplashFetch}
                        disabled={unsplashLoading}
                        className="text-xs px-2 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-md transition-colors flex items-center gap-1"
                      >
                        {unsplashLoading ? (
                          <><div className="w-2.5 h-2.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />提案中</>
                        ) : "提案する"}
                      </button>
                    </div>
                    {unsplashError && (
                      <p className="text-xs text-red-600 mb-2">{unsplashError}</p>
                    )}
                    {unsplashResult && (
                      <UnsplashPicker
                        result={unsplashResult}
                        selectedImages={images}
                        onSelect={handleImageSelect}
                        onDeselect={handleImageDeselect}
                      />
                    )}
                  </div>
                </div>
              </Accordion>

              {/* AI修正 */}
              <Accordion title="AI修正">
                <RevisionForm onRevise={handleRevise} loading={revisionLoading} />
                {revisionError && (
                  <div className="mt-2 text-xs text-red-600 bg-red-50 rounded p-2">{revisionError}</div>
                )}
                {revisionLoading && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                    修正中…
                  </div>
                )}
              </Accordion>

              {/* SEO */}
              <Accordion title="SEOチェック">
                <SEOChecker html={result.html} />
              </Accordion>

              {/* 再生成 */}
              <Accordion title="再生成">
                <div className="space-y-3">
                  <p className="text-xs text-gray-500">入力内容を変更して再生成します。</p>
                  <LPForm onSubmit={handleGenerate} loading={loading} importedValues={importedValues} />
                  {loading && (
                    <div className="flex items-center gap-2 py-2">
                      <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
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
                          ? "text-indigo-600 border-indigo-600 bg-indigo-50"
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
                          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "text" ? "bg-indigo-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                        >✏ テキスト</button>
                        <button
                          onClick={() => handleEditModeToggle("style")}
                          title="スタイル編集モード"
                          className={`px-2.5 py-1.5 text-xs font-semibold transition-colors ${editMode === "style" ? "bg-purple-600 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                        >🎨 スタイル</button>
                      </div>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                      <button
                        onClick={() => setPreviewMode("desktop")}
                        title="デスクトップ"
                        className={`p-1.5 rounded text-sm transition-colors ${previewMode === "desktop" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:text-gray-600"}`}
                      >🖥️</button>
                      <button
                        onClick={() => setPreviewMode("mobile")}
                        title="モバイル"
                        className={`p-1.5 rounded text-sm transition-colors ${previewMode === "mobile" ? "bg-indigo-100 text-indigo-700" : "text-gray-400 hover:text-gray-600"}`}
                      >📱</button>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                    </>
                  )}
                  <button
                    onClick={handleUndo}
                    disabled={htmlHistory.length === 0}
                    title="元に戻す"
                    className="p-1.5 rounded text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >↩</button>
                  <button
                    onClick={handleRedo}
                    disabled={htmlFuture.length === 0}
                    title="やり直し"
                    className="p-1.5 rounded text-sm text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 disabled:opacity-25 disabled:cursor-not-allowed transition-colors"
                  >↪</button>
                  {activeTab === "netlify" && (
                    <>
                      <div className="w-px h-5 bg-gray-200 mx-1" />
                      <button
                        onClick={() => downloadFile(
                          buildNetlifyHtml(result.html, effectiveCss, serviceName, unsplashImages),
                          `${serviceName || "lp"}.html`,
                          "text/html"
                        )}
                        className="text-xs px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-semibold transition-colors"
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
                        <span className="text-[11px] text-indigo-500 font-medium">✏ テキストをクリックして直接編集</span>
                      ) : (
                        <span className="text-[11px] text-purple-600 font-medium">
                          🎨 要素をクリックしてスタイルを編集
                          {selectedElement && (
                            <span className="ml-2 text-purple-400">
                              — {selectedElement.label || selectedElement.selector}
                            </span>
                          )}
                        </span>
                      )}
                      {(htmlHistory.length > 0 || htmlFuture.length > 0) && (
                        <span className="text-[10px] text-gray-400 ml-auto">
                          {htmlHistory.length > 0 && `↩${htmlHistory.length}`}
                          {htmlFuture.length > 0 && ` ↪${htmlFuture.length}`}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <LPPreview
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
              <div className="w-14 h-14 rounded-2xl bg-purple-100 flex items-center justify-center text-2xl">
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
                    <span className="w-5 h-5 rounded bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">
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
    </div>
  );
}
