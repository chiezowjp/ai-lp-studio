"use client";

import { useState, useRef, useMemo, useCallback } from "react";
import { SelectedElement } from "@/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface InsertedImageConfig {
  id: string;
  url: string;
  mobileImageUrl: string; // "" = スマホ専用画像なし
  alt: string;
  width: string;
  alignment: "left" | "center" | "right";
  borderRadius: number;
  marginV: number;
}

type InsertPosition = "before" | "after" | "section_end";

const WIDTH_PRESETS = ["50%", "80%", "100%"] as const;

// ─── DOM helpers（挿入済み画像）───────────────────────────────────────────────

function newId() {
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function buildWrapper(doc: Document, cfg: InsertedImageConfig): HTMLElement {
  const div = doc.createElement("div");
  div.className = "lp-inserted-img";
  div.setAttribute(
    "style",
    `text-align:${cfg.alignment};margin-top:${cfg.marginV}px;margin-bottom:${cfg.marginV}px;`,
  );

  const img = doc.createElement("img");
  img.setAttribute("data-element-id", cfg.id);
  img.src = cfg.url;
  img.alt = cfg.alt;
  img.setAttribute(
    "style",
    [
      `width:${cfg.width}`,
      "max-width:100%",
      "height:auto",
      "display:inline-block",
      `border-radius:${cfg.borderRadius}px`,
    ].join(";"),
  );

  if (cfg.mobileImageUrl) {
    // スマホ用画像がある場合は <picture> でラップ
    const picture = doc.createElement("picture");
    const source = doc.createElement("source");
    source.setAttribute("media", "(max-width: 640px)");
    source.setAttribute("srcset", cfg.mobileImageUrl);
    picture.appendChild(source);
    picture.appendChild(img);
    div.appendChild(picture);
  } else {
    div.appendChild(img);
  }
  return div;
}

/**
 * DOMParser ドキュメント内で el の最近の lp-* セクションを上に辿る。
 * docBody を終端として使うことで window.document.body との混同を防ぐ。
 */
function findParentSectionInDoc(el: Element, docBody: Element): Element | null {
  const SKIP = /^lp-(vs|section-img|inserted)/;
  const SECTION = /^lp-[a-z]/;
  let cur: Element | null = el.parentElement;
  while (cur && cur !== docBody) {
    for (const c of Array.from(cur.classList)) {
      if (SECTION.test(c) && !SKIP.test(c)) return cur;
    }
    cur = cur.parentElement;
  }
  return null;
}

export function insertImageAdjacentToElement(
  html: string,
  selector: string,
  position: InsertPosition,
  cfg: InsertedImageConfig,
  /** クリック時に付与された data-element-id。あれば曖昧な CSS selector より優先 */
  elementId?: string,
): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");

  const el = elementId
    ? (doc.querySelector(`[data-element-id="${elementId}"]`) ?? doc.querySelector(selector))
    : doc.querySelector(selector);
  if (!el) return html;

  const wrapper = buildWrapper(doc, cfg);
  const isTopLevelSection = el.parentElement?.tagName === "BODY";

  if (isTopLevelSection) {
    if (position === "before") {
      el.insertBefore(wrapper, el.firstChild);
    } else {
      el.appendChild(wrapper);
    }
  } else if (position === "before") {
    el.parentElement?.insertBefore(wrapper, el);
  } else if (position === "after") {
    el.parentElement?.insertBefore(wrapper, el.nextSibling);
  } else {
    const sec = findParentSectionInDoc(el, doc.body) ?? el.parentElement;
    sec?.appendChild(wrapper);
  }

  return doc.body.innerHTML;
}

export function updateInsertedImage(
  html: string,
  imageId: string,
  updates: Partial<InsertedImageConfig>,
): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const img = doc.querySelector(`[data-element-id="${imageId}"]`);
  if (!img) return html;
  // <picture> でラップされている場合も考慮して closest で .lp-inserted-img を探す
  const wrapper = img.closest(".lp-inserted-img");
  if (!wrapper) return html;
  const current = parseInsertedImageFromDoc(doc, imageId);
  if (!current) return html;
  const merged: InsertedImageConfig = { ...current, ...updates };
  const newWrapper = buildWrapper(doc, merged);
  wrapper.parentElement?.replaceChild(newWrapper, wrapper);
  return doc.body.innerHTML;
}

export function deleteInsertedImage(html: string, imageId: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const img = doc.querySelector(`[data-element-id="${imageId}"]`);
  const wrapper = img?.closest(".lp-inserted-img");
  wrapper?.remove();
  return doc.body.innerHTML;
}

function parseInsertedImageFromDoc(doc: Document, imageId: string): InsertedImageConfig | null {
  const img = doc.querySelector(`[data-element-id="${imageId}"]`) as HTMLImageElement | null;
  if (!img) return null;
  // <picture> でラップされていても .lp-inserted-img を確実に取得
  const wrapper = img.closest(".lp-inserted-img");
  const ws = wrapper?.getAttribute("style") ?? "";
  const is = img.getAttribute("style") ?? "";
  // スマホ用画像（<source media="(max-width: 640px)">）を取得
  const sourceEl = wrapper?.querySelector("picture > source[media]") as HTMLSourceElement | null;
  const mobileImageUrl = sourceEl?.getAttribute("srcset") ?? "";
  return {
    id: imageId,
    url: img.src,
    mobileImageUrl,
    alt: img.alt ?? "",
    width: is.match(/width:([^;]+)/)?.[1]?.trim() ?? "80%",
    alignment: (ws.match(/text-align:\s*(left|center|right)/)?.[1] ?? "center") as InsertedImageConfig["alignment"],
    borderRadius: parseInt(is.match(/border-radius:(\d+)px/)?.[1] ?? "8", 10),
    marginV: parseInt(ws.match(/margin-top:\s*(\d+)px/)?.[1] ?? "16", 10),
  };
}

export function parseInsertedImage(html: string, imageId: string): InsertedImageConfig | null {
  if (typeof window === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  return parseInsertedImageFromDoc(doc, imageId);
}


// ─── Sub-components ───────────────────────────────────────────────────────────

function SliderRow({
  label, value, min, max, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-400">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00AFCC]"
      />
    </div>
  );
}


// ─── 挿入済み画像の編集パネル ─────────────────────────────────────────────────

interface EditProps {
  imageId: string;
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

function InsertedImageEditPanel({ imageId, html, onUpdate, onDeselect }: EditProps) {
  const cfg = useMemo(() => parseInsertedImage(html, imageId), [html, imageId]);
  const replaceRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);
  const [showMobilePanel, setShowMobilePanel] = useState(false);

  if (!cfg) {
    return (
      <div className="p-4 text-xs text-gray-400">
        画像が見つかりません（削除済みの可能性があります）
      </div>
    );
  }

  const upd = (partial: Partial<InsertedImageConfig>) => {
    onUpdate(updateInsertedImage(html, imageId, partial));
  };

  const handleReplace = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => upd({ url: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleMobileFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => upd({ mobileImageUrl: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">📷</span>
          <span className="text-sm font-bold text-gray-800">挿入済み画像</span>
        </div>
        <button
          onClick={onDeselect}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* PC画像プレビュー */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cfg.url}
          alt={cfg.alt || "画像"}
          className="w-full h-28 object-contain rounded-xl border border-gray-200 bg-gray-50"
        />

        {/* スマホ用画像パネル */}
        {showMobilePanel || cfg.mobileImageUrl ? (
          <div className="border border-indigo-200 rounded-xl p-3 space-y-2 bg-indigo-50/40">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-indigo-600">📱 スマホ用画像</p>
              <div className="flex gap-2">
                {cfg.mobileImageUrl && (
                  <button
                    onClick={() => { upd({ mobileImageUrl: "" }); setShowMobilePanel(false); }}
                    className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
                  >
                    削除
                  </button>
                )}
                {!cfg.mobileImageUrl && (
                  <button
                    onClick={() => setShowMobilePanel(false)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    閉じる
                  </button>
                )}
              </div>
            </div>
            {cfg.mobileImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cfg.mobileImageUrl}
                alt="スマホ用"
                className="w-full h-20 object-contain rounded-lg border border-indigo-200 bg-white"
              />
            )}
            <label className="flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed border-indigo-300 rounded-xl cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors text-[10px] text-indigo-500">
              <span>📁</span>
              {cfg.mobileImageUrl ? "差し替える" : "画像を選択"}
              <input
                ref={mobileFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleMobileFile(f);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="text-[10px] text-indigo-400/80 leading-relaxed">
              640px以下の画面でこの画像に自動切替えされます
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowMobilePanel(true)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold rounded-xl border border-dashed border-gray-300 text-gray-500 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/40 transition-colors"
          >
            <span>📱</span> スマホ用画像を追加
          </button>
        )}

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">配置</label>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => upd({ alignment: a })}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                  cfg.alignment === a
                    ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                    : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"
                }`}
              >
                {a === "left" ? "← 左" : a === "center" ? "中央" : "右 →"}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">横幅</label>
          <div className="flex gap-1 mb-1">
            {WIDTH_PRESETS.map((w) => (
              <button
                key={w}
                onClick={() => upd({ width: w })}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                  cfg.width === w
                    ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                    : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={WIDTH_PRESETS.includes(cfg.width as (typeof WIDTH_PRESETS)[number]) ? "" : cfg.width}
            onChange={(e) => upd({ width: e.target.value })}
            placeholder="例: 320px"
            className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
          />
        </div>

        <SliderRow label="角丸" value={cfg.borderRadius} min={0} max={40} unit="px"
          onChange={(v) => upd({ borderRadius: v })} />
        <SliderRow label="上下余白" value={cfg.marginV} min={0} max={64} unit="px"
          onChange={(v) => upd({ marginV: v })} />

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">altテキスト</label>
          <input
            type="text" value={cfg.alt}
            onChange={(e) => upd({ alt: e.target.value })}
            placeholder="画像の説明（省略可）"
            className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
          />
        </div>

        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">画像を差し替え</label>
          <label className="flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#00AFCC] hover:bg-[#E6F8FC] transition-colors text-[10px] text-gray-500">
            <span>🖼</span>
            <span>クリックまたはドロップ</span>
            <input
              ref={replaceRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleReplace(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <button
          onClick={() => {
            onUpdate(deleteInsertedImage(html, imageId));
            onDeselect();
          }}
          className="w-full py-2.5 text-xs font-semibold rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
        >
          🗑 この画像を削除
        </button>
      </div>
    </div>
  );
}

// ─── imgblock セクション編集 ──────────────────────────────────────────────────

interface ImgBlockCfg {
  imageUrl: string;
  mobileImageUrl: string; // "" = スマホ専用画像なし
  alt: string;
  alignment: "left" | "center" | "right";
  width: string;
  height: string;
  borderRadius: string;
  paddingTop: string;
  paddingBottom: string;
  paddingH: string;
}

/** padding shorthand → 上下左右 */
function parsePaddingShorthand(p: string) {
  const parts = p.trim().split(/\s+/);
  if (parts.length === 1) return { t: parts[0], r: parts[0], b: parts[0], l: parts[0] };
  if (parts.length === 2) return { t: parts[0], r: parts[1], b: parts[0], l: parts[1] };
  if (parts.length === 3) return { t: parts[0], r: parts[1], b: parts[2], l: parts[1] };
  return { t: parts[0], r: parts[1], b: parts[2], l: parts[3] };
}

function buildImgBlockHtml(cfg: ImgBlockCfg, uniqueClass?: string | null): string {
  const alignMod =
    cfg.alignment === "left" ? "left" : cfg.alignment === "right" ? "right" : "center";
  const src = cfg.imageUrl || "https://placehold.co/800x450?text=Image";
  const imgStyle = [
    `width:${cfg.width || "100%"}`,
    cfg.height && cfg.height !== "auto" ? `height:${cfg.height}` : "",
    cfg.borderRadius && cfg.borderRadius !== "0" && cfg.borderRadius !== "0px"
      ? `border-radius:${cfg.borderRadius}`
      : "",
  ]
    .filter(Boolean)
    .join(";");
  const pt = cfg.paddingTop || "0";
  const pb = cfg.paddingBottom || "0";
  const ph = cfg.paddingH || "0";
  const sectionStyle =
    `padding-top:${pt};padding-bottom:${pb};padding-left:${ph};padding-right:${ph}`;
  // 一意クラスがある場合は保持して2つ目以降のセクションと区別できるようにする
  const classAttr = uniqueClass ? `${uniqueClass} lp-imgblock` : "lp-imgblock";
  const imgTag = `<img class="lp-imgblock-img" src="${src}" alt="${cfg.alt}"${imgStyle ? ` style="${imgStyle}"` : ""}>`;
  // スマホ用画像がある場合は <picture> でラップする
  const innerImg = cfg.mobileImageUrl
    ? `<picture>\n      <source media="(max-width: 640px)" srcset="${cfg.mobileImageUrl}">\n      ${imgTag}\n    </picture>`
    : imgTag;
  return `<section class="${classAttr}" style="${sectionStyle}">
  <div class="lp-imgblock-inner lp-imgblock-inner--${alignMod}">
    ${innerImg}
  </div>
</section>`;
}

function parseImgBlockFromHtml(html: string, uniqueClass?: string | null): ImgBlockCfg | null {
  if (typeof window === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  // 一意クラスがある場合はそれを使って正確なセクションを特定する
  const selector = uniqueClass ? `.${uniqueClass}` : ".lp-imgblock";
  const section = doc.querySelector(selector);
  const img = section?.querySelector("img");
  if (!section || !img) return null;
  const ss = section.getAttribute("style") ?? "";
  const is = img.getAttribute("style") ?? "";
  const innerEl = section.querySelector('[class*="lp-imgblock-inner--"]');
  const alignMatch = (innerEl?.className ?? "").match(
    /lp-imgblock-inner--(left|center|right)/,
  );

  // 個別プロパティ優先、なければ shorthand にフォールバック
  const shortMatch = ss.match(/(?:^|;)\s*padding:\s*([^;]+)/);
  const sh = shortMatch ? parsePaddingShorthand(shortMatch[1]) : null;

  const paddingTop    = ss.match(/padding-top:\s*([^;]+)/)?.[1]?.trim()    ?? sh?.t ?? "0";
  const paddingBottom = ss.match(/padding-bottom:\s*([^;]+)/)?.[1]?.trim() ?? sh?.b ?? "0";
  const paddingH      = ss.match(/padding-left:\s*([^;]+)/)?.[1]?.trim()   ?? sh?.l ?? "0";

  // <picture><source> があればスマホ用画像を取得
  const sourceEl = section.querySelector("picture > source[media]") as HTMLSourceElement | null;
  const mobileImageUrl = sourceEl?.getAttribute("srcset") ?? "";

  return {
    imageUrl: img.getAttribute("src") ?? "",
    mobileImageUrl,
    alt: img.getAttribute("alt") ?? "",
    alignment: (alignMatch?.[1] ?? "center") as "left" | "center" | "right",
    width: is.match(/width:\s*([^;]+)/)?.[1]?.trim() ?? "100%",
    height: is.match(/height:\s*([^;]+)/)?.[1]?.trim() ?? "auto",
    borderRadius: is.match(/border-radius:\s*([^;]+)/)?.[1]?.trim() ?? "0",
    paddingTop,
    paddingBottom,
    paddingH,
  };
}

function replaceImgBlockInHtml(html: string, cfg: ImgBlockCfg, uniqueClass?: string | null): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const selector = uniqueClass ? `.${uniqueClass}` : ".lp-imgblock";
  const section = doc.querySelector(selector) as HTMLElement | null;
  if (!section) return html;

  // "img.lp-imgblock-img" → "img" にフォールバック（AI生成のimgblockはクラスなしの場合がある）
  const img = (section.querySelector("img.lp-imgblock-img") ?? section.querySelector("img")) as HTMLImageElement | null;
  if (!img) return html;

  // セクション style を更新
  const pt = cfg.paddingTop || "0";
  const pb = cfg.paddingBottom || "0";
  const ph = cfg.paddingH || "0";
  section.setAttribute("style", `padding-top:${pt};padding-bottom:${pb};padding-left:${ph};padding-right:${ph}`);

  // inner div の alignment クラスを更新
  const alignMod = cfg.alignment === "left" ? "left" : cfg.alignment === "right" ? "right" : "center";
  const innerEl = section.querySelector('[class*="lp-imgblock-inner"]') as HTMLElement | null;
  if (innerEl) {
    innerEl.className = `lp-imgblock-inner lp-imgblock-inner--${alignMod}`;
  }

  // img の属性を更新
  const src = cfg.imageUrl || "https://placehold.co/800x450?text=Image";
  const imgStyleParts = [
    `width:${cfg.width || "100%"}`,
    cfg.height && cfg.height !== "auto" ? `height:${cfg.height}` : "",
    cfg.borderRadius && cfg.borderRadius !== "0" && cfg.borderRadius !== "0px"
      ? `border-radius:${cfg.borderRadius}`
      : "",
  ].filter(Boolean);
  img.setAttribute("src", src);
  img.setAttribute("alt", cfg.alt);
  if (imgStyleParts.length > 0) {
    img.setAttribute("style", imgStyleParts.join(";"));
  } else {
    img.removeAttribute("style");
  }

  // スマホ用画像の <picture> ラップを更新（同一ドキュメント内で操作）
  const picturePar = img.closest("picture");
  if (cfg.mobileImageUrl) {
    if (picturePar) {
      // 既存 <picture> の <source> を更新
      let sourceEl = picturePar.querySelector("source[media]") as HTMLSourceElement | null;
      if (!sourceEl) {
        sourceEl = doc.createElement("source") as HTMLSourceElement;
        sourceEl.setAttribute("media", "(max-width: 640px)");
        picturePar.insertBefore(sourceEl, img);
      }
      sourceEl.setAttribute("srcset", cfg.mobileImageUrl);
    } else {
      // <img> を <picture> でラップ
      const picture = doc.createElement("picture");
      const sourceEl = doc.createElement("source") as HTMLSourceElement;
      sourceEl.setAttribute("media", "(max-width: 640px)");
      sourceEl.setAttribute("srcset", cfg.mobileImageUrl);
      img.parentNode!.insertBefore(picture, img);
      picture.appendChild(sourceEl);
      picture.appendChild(img);
    }
  } else {
    // スマホ用画像なし → <picture> を解除
    if (picturePar) {
      picturePar.parentNode!.insertBefore(img, picturePar);
      picturePar.remove();
    }
  }

  return doc.body.innerHTML;
}

// ImgBlock 右パネル編集コンポーネント ─────────────────────────────────────────

interface ImgBlockEditProps {
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
  /** 複数 imgblock を区別するための一意クラス（例: "lp-imgblock_abc123"）*/
  uniqueClass?: string | null;
}

function ImgBlockEditPanel({ html, onUpdate, onDeselect, uniqueClass }: ImgBlockEditProps) {
  const cfg = useMemo(() => parseImgBlockFromHtml(html, uniqueClass), [html, uniqueClass]);
  const [isDragging, setIsDragging] = useState(false);
  const [isMobileDragging, setIsMobileDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const mobileFileRef = useRef<HTMLInputElement>(null);

  const upd = useCallback(
    (partial: Partial<ImgBlockCfg>) => {
      if (!cfg) return;
      onUpdate(replaceImgBlockInHtml(html, { ...cfg, ...partial }, uniqueClass));
    },
    [cfg, html, onUpdate, uniqueClass],
  );

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => upd({ imageUrl: e.target?.result as string });
    reader.readAsDataURL(file);
  };

  const handleMobileFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (!cfg) return;
    // upd (useCallback) を経由せず onUpdate を直接呼ぶことで closure の stale 問題を回避
    const currentCfg = cfg;
    const currentHtml = html;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (!dataUrl) return;
      onUpdate(replaceImgBlockInHtml(currentHtml, { ...currentCfg, mobileImageUrl: dataUrl }, uniqueClass));
    };
    reader.readAsDataURL(file);
  };

  if (!cfg) {
    return (
      <div className="p-4 text-xs text-gray-400">
        画像セクションが見つかりません
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🖼️</span>
          <span className="text-sm font-bold text-gray-800">画像セクション</span>
        </div>
        <button
          onClick={onDeselect}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* プレビュー */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cfg.imageUrl}
          alt={cfg.alt || "画像"}
          className="w-full h-28 object-contain rounded-xl border border-gray-200 bg-gray-50"
        />

        {/* 差し替え */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            画像を差し替え
          </label>
          <label
            className={`flex items-center justify-center gap-2 w-full py-2.5 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-[10px] text-gray-500 ${
              isDragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 hover:border-[#00AFCC] hover:bg-[#E6F8FC]"
            }`}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <span>📁</span>クリックまたはドロップ
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        {/* スマホ用画像 */}
        <div className="border border-gray-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-gray-600">📱 スマホ用画像</p>
            {cfg.mobileImageUrl && (
              <button
                onClick={() => upd({ mobileImageUrl: "" })}
                className="text-[10px] text-red-400 hover:text-red-600 transition-colors"
              >
                削除
              </button>
            )}
          </div>
          {cfg.mobileImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.mobileImageUrl}
              alt="スマホ用"
              className="w-full h-20 object-contain rounded-lg border border-gray-200 bg-gray-50"
            />
          ) : (
            <p className="text-[10px] text-gray-400">未設定（PC画像をそのまま使用）</p>
          )}
          <label
            className={`flex items-center justify-center gap-2 w-full py-2 border-2 border-dashed rounded-xl cursor-pointer transition-colors text-[10px] text-gray-500 ${
              isMobileDragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 hover:border-[#00AFCC] hover:bg-[#E6F8FC]"
            }`}
            onDrop={(e) => {
              e.preventDefault();
              setIsMobileDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleMobileFile(f);
            }}
            onDragOver={(e) => { e.preventDefault(); setIsMobileDragging(true); }}
            onDragLeave={() => setIsMobileDragging(false)}
          >
            <span>📁</span>
            {cfg.mobileImageUrl ? "スマホ画像を差し替え" : "スマホ用画像をアップロード"}
            <input
              ref={mobileFileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleMobileFile(f);
                e.target.value = "";
              }}
            />
          </label>
          <p className="text-[10px] text-gray-400 leading-relaxed">
            640px以下の画面でこの画像に自動切替えされます
          </p>
        </div>

        {/* バナープリセット */}
        <div>
          <p className="text-[10px] font-semibold text-gray-500 mb-1">プリセット</p>
          <button
            onClick={() =>
              upd({
                paddingTop: "0", paddingBottom: "0", paddingH: "0",
                width: "100%", borderRadius: "0", alignment: "center",
              })
            }
            className="px-3 py-1.5 text-[10px] font-semibold rounded-lg border border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC] transition-colors"
          >
            🖼️ バナー（余白なし・横幅100%）
          </button>
        </div>

        {/* altテキスト */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            altテキスト
          </label>
          <input
            type="text"
            value={cfg.alt}
            onChange={(e) => upd({ alt: e.target.value })}
            placeholder="画像の説明（省略可）"
            className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
          />
        </div>

        {/* 配置 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            配置
          </label>
          <div className="flex gap-1">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                onClick={() => upd({ alignment: a })}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                  cfg.alignment === a
                    ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                    : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"
                }`}
              >
                {a === "left" ? "← 左" : a === "center" ? "中央" : "右 →"}
              </button>
            ))}
          </div>
        </div>

        {/* 横幅 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            横幅
          </label>
          <div className="flex gap-1 mb-1">
            {(["50%", "80%", "100%"] as const).map((w) => (
              <button
                key={w}
                onClick={() => upd({ width: w })}
                className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                  cfg.width === w
                    ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                    : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"
                }`}
              >
                {w}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={["50%", "80%", "100%"].includes(cfg.width) ? "" : cfg.width}
            onChange={(e) => upd({ width: e.target.value })}
            placeholder="例: 320px"
            className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
          />
        </div>

        {/* 角丸 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            角丸
          </label>
          <input
            type="text"
            value={cfg.borderRadius}
            onChange={(e) => upd({ borderRadius: e.target.value })}
            placeholder="0 / 12px / 50%"
            className="w-full text-[10px] border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
          />
        </div>

        {/* 余白（3分割）*/}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            余白
          </label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { key: "paddingTop",    label: "上" },
                { key: "paddingBottom", label: "下" },
                { key: "paddingH",      label: "左右" },
              ] as const
            ).map(({ key, label }) => (
              <div key={key}>
                <p className="text-[9px] text-gray-400 text-center mb-0.5">{label}</p>
                <input
                  type="text"
                  value={cfg[key]}
                  onChange={(e) => upd({ [key]: e.target.value })}
                  placeholder="0"
                  className="w-full text-[10px] border border-gray-200 rounded-lg px-1.5 py-1.5 text-center focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Before/After 画像プレースホルダー編集 ────────────────────────────────────

/** .lp-ba-img プレースホルダーの現在の img src を取得 */
function getBeforeAfterSrc(html: string, elementId: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!el) return "";
  return (el.querySelector("img") as HTMLImageElement | null)?.getAttribute("src") ?? "";
}

/** .lp-ba-img の内容を実際の画像で置き換え（初回 or 差し替え） */
function replaceBeforeAfterImage(html: string, elementId: string, imageUrl: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!el) return html;
  el.innerHTML = `<img src="${imageUrl}" alt="" style="width:100%;height:100%;object-fit:cover;display:block;">`;
  return doc.body.innerHTML;
}

interface BeforeAfterImageEditProps {
  elementId: string;
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

function BeforeAfterImageEditPanel({ elementId, html, onUpdate, onDeselect }: BeforeAfterImageEditProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentSrc = useMemo(() => getBeforeAfterSrc(html, elementId), [html, elementId]);
  const isPlaceholder = !currentSrc || currentSrc.includes("placehold.co");

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) =>
      onUpdate(replaceBeforeAfterImage(html, elementId, e.target?.result as string));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🔄</span>
          <span className="text-sm font-bold text-gray-800">Before / After 画像</span>
        </div>
        <button
          onClick={onDeselect}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 現在の画像プレビュー */}
        {isPlaceholder ? (
          <div className="w-full h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
            <span className="text-xs text-gray-400">画像未設定</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSrc}
            alt=""
            className="w-full h-28 object-cover rounded-xl border border-gray-200"
          />
        )}

        {/* アップロードゾーン */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            {isPlaceholder ? "画像をアップロード" : "画像を差し替え"}
          </label>
          <label
            className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              isDragging
                ? "border-[#00AFCC] bg-[#E6F8FC]"
                : "border-gray-300 hover:border-[#00AFCC] hover:bg-[#E6F8FC]"
            }`}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <span className="text-2xl">🖼</span>
            <span className="text-xs font-semibold text-[#00AFCC] mt-1">クリックまたはドロップ</span>
            <span className="text-[10px] text-[#00AFCC]/70 mt-0.5">JPG / PNG / WebP</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <p className="text-[10px] text-gray-400 leading-relaxed">
          もう一方の枠をクリックすると別の画像を設定できます。Ctrl+Z でUndo可能。
        </p>
      </div>
    </div>
  );
}

// ─── ギャラリーアイテム編集 ───────────────────────────────────────────────────

/** data-element-id がギャラリー画像（.lp-gallery-img または .lp-gallery-item）を指すか */
function isGalleryElement(html: string, elementId: string): boolean {
  if (typeof window === "undefined") return false;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!el) return false;
  return (
    el.classList.contains("lp-gallery-img") ||
    el.classList.contains("lp-gallery-item")
  );
}

/** ギャラリーアイテムの img src を更新して HTML を返す */
function updateGalleryItemImage(
  html: string,
  elementId: string,
  imageUrl: string,
): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!el) return html;
  // elementId がimg 自体に付いている場合と、親 div に付いている場合の両対応
  const img =
    el.tagName === "IMG"
      ? (el as HTMLImageElement)
      : (el.querySelector("img.lp-gallery-img") as HTMLImageElement | null);
  if (img) img.setAttribute("src", imageUrl);
  return doc.body.innerHTML;
}

/** ギャラリーアイテムの現在の img src を取得 */
function getGalleryItemSrc(html: string, elementId: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const el = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!el) return "";
  const img =
    el.tagName === "IMG"
      ? (el as HTMLImageElement)
      : (el.querySelector("img") as HTMLImageElement | null);
  return img?.getAttribute("src") ?? "";
}

interface GalleryItemEditProps {
  elementId: string;
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

function GalleryItemEditPanel({
  elementId,
  html,
  onUpdate,
  onDeselect,
}: GalleryItemEditProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const currentSrc = useMemo(
    () => getGalleryItemSrc(html, elementId),
    [html, elementId],
  );
  const isPlaceholder =
    !currentSrc || currentSrc.includes("placehold.co");

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) =>
      onUpdate(
        updateGalleryItemImage(html, elementId, e.target?.result as string),
      );
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">🖼️</span>
          <span className="text-sm font-bold text-gray-800">ギャラリー画像</span>
        </div>
        <button
          onClick={onDeselect}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 現在の画像プレビュー */}
        {isPlaceholder ? (
          <div className="w-full h-28 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center">
            <span className="text-xs text-gray-400">画像未設定</span>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={currentSrc}
            alt=""
            className="w-full h-28 object-cover rounded-xl border border-gray-200"
          />
        )}

        {/* アップロードゾーン */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">
            {isPlaceholder ? "画像をアップロード" : "画像を差し替え"}
          </label>
          <label
            className={`flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              isDragging
                ? "border-[#00AFCC] bg-[#E6F8FC]"
                : "border-gray-300 hover:border-[#00AFCC] hover:bg-[#E6F8FC]"
            }`}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
          >
            <span className="text-2xl">🖼</span>
            <span className="text-xs font-semibold text-[#00AFCC] mt-1">
              クリックまたはドロップ
            </span>
            <span className="text-[10px] text-[#00AFCC]/70 mt-0.5">
              JPG / PNG / WebP
            </span>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
          </label>
        </div>

        <p className="text-[10px] text-gray-400 leading-relaxed">
          他のコマをクリックすると別の画像を設定できます。Ctrl+Z でUndo可能。
        </p>
      </div>
    </div>
  );
}

// ─── お客様の声カード編集 ─────────────────────────────────────────────────────

interface VoiceCardData {
  stars: number; // 1–5
  text: string;
  name: string;
}

function parseVoiceCard(html: string, elementId: string): VoiceCardData | null {
  if (typeof window === "undefined") return null;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const card = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!card) return null;
  const starEl  = card.querySelector(".lp-voice-star");
  const textEl  = card.querySelector(".lp-voice-text");
  const nameEl  = card.querySelector(".lp-voice-name");
  const starsCount = (starEl?.textContent?.match(/★/g) ?? []).length;
  return {
    stars: starsCount || 5,
    text:  textEl?.textContent?.trim() ?? "",
    name:  nameEl?.textContent?.trim() ?? "",
  };
}

function updateVoiceCard(html: string, elementId: string, data: VoiceCardData): string {
  if (typeof window === "undefined") return html;
  const doc  = new DOMParser().parseFromString(html, "text/html");
  const card = doc.querySelector(`[data-element-id="${elementId}"]`);
  if (!card) return html;
  const starEl = card.querySelector(".lp-voice-star");
  const textEl = card.querySelector(".lp-voice-text");
  const nameEl = card.querySelector(".lp-voice-name");
  if (starEl) starEl.textContent = "★".repeat(data.stars) + "☆".repeat(5 - data.stars);
  if (textEl) textEl.textContent = data.text;
  if (nameEl) nameEl.textContent = data.name;
  return doc.body.innerHTML;
}

interface VoiceCardEditProps {
  elementId: string;
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

function VoiceCardEditPanel({ elementId, html, onUpdate, onDeselect }: VoiceCardEditProps) {
  const initial = useMemo(() => parseVoiceCard(html, elementId), [html, elementId]);
  const [stars, setStars] = useState(initial?.stars ?? 5);
  const [text,  setText]  = useState(initial?.text  ?? "");
  const [name,  setName]  = useState(initial?.name  ?? "");

  // カードが切り替わったらリセット
  const prevId = useRef(elementId);
  if (prevId.current !== elementId) {
    prevId.current = elementId;
    const d = parseVoiceCard(html, elementId);
    if (d) { setStars(d.stars); setText(d.text); setName(d.name); }
  }

  const apply = () =>
    onUpdate(updateVoiceCard(html, elementId, { stars, text, name }));

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">💬</span>
          <span className="text-sm font-bold text-gray-800">お客様の声</span>
        </div>
        <button
          onClick={onDeselect}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 星評価 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">星評価</label>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                onClick={() => setStars(n)}
                className="text-xl leading-none focus:outline-none transition-transform hover:scale-110"
                title={`${n}つ星`}
              >
                {n <= stars ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>

        {/* レビュー本文 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">レビュー本文</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] resize-y"
            placeholder="お客様の声を入力してください"
          />
        </div>

        {/* 投稿者名 */}
        <div>
          <label className="block text-[10px] font-semibold text-gray-500 mb-1">投稿者名・属性</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#00AFCC]"
            placeholder="— 30代 女性・主婦"
          />
        </div>

        <button
          onClick={apply}
          className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#00AFCC] text-white hover:bg-[#0099b3] transition-colors"
        >
          適用する
        </button>

        <p className="text-[10px] text-gray-400 leading-relaxed">
          他のカードをクリックすると別のカードを編集できます。
        </p>
      </div>
    </div>
  );
}

// ─── 新規挿入フロー ───────────────────────────────────────────────────────────

interface InsertFlowProps {
  selectedElement: SelectedElement;
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

function InsertFlow({ selectedElement, html, onUpdate, onDeselect }: InsertFlowProps) {
  const [pendingPos, setPendingPos] = useState<InsertPosition | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const POSITIONS: { id: InsertPosition; label: string; desc: string }[] = [
    { id: "before",      label: "⬆ この上に挿入",  desc: "選択要素の直前" },
    { id: "after",       label: "⬇ この下に挿入",  desc: "選択要素の直後" },
    { id: "section_end", label: "⤵ セクション末尾", desc: "セクション最後尾" },
  ];

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/") || !pendingPos) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const cfg: InsertedImageConfig = {
        id: newId(),
        url: e.target?.result as string,
        mobileImageUrl: "",
        alt: "",
        width: "80%",
        alignment: "center",
        borderRadius: 8,
        marginV: 16,
      };
      onUpdate(insertImageAdjacentToElement(
        html, selectedElement.selector, pendingPos, cfg, selectedElement.elementId,
      ));
      setPendingPos(null);
    };
    reader.readAsDataURL(file);
  };

  const elLabel = selectedElement.label || selectedElement.tagName;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-base">📷</span>
          <span className="text-sm font-bold text-gray-800">画像を挿入</span>
        </div>
        <button
          onClick={onDeselect}
          className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="bg-indigo-50 rounded-xl px-3 py-2.5 border border-indigo-100">
          <p className="text-[10px] font-semibold text-indigo-500 mb-0.5">選択中の要素</p>
          <p className="text-xs text-indigo-800 font-medium truncate">「{elLabel}」</p>
          <p className="text-[10px] text-indigo-400 font-mono truncate">{selectedElement.selector}</p>
        </div>

        {!pendingPos && (
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-500">① 挿入位置を選択</p>
            {POSITIONS.map((pos) => (
              <button
                key={pos.id}
                onClick={() => setPendingPos(pos.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-[#00AFCC] hover:bg-[#E6F8FC] hover:text-[#00AFCC] transition-all text-left group"
              >
                <span className="text-base">{pos.label.split(" ")[0]}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700 group-hover:text-[#00AFCC]">
                    {pos.label.slice(2)}
                  </p>
                  <p className="text-[10px] text-gray-400">{pos.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {pendingPos && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPendingPos(null)}
                className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
              >
                ← 戻る
              </button>
              <p className="text-[10px] font-semibold text-gray-500">
                ② 画像をアップロード
                <span className="ml-1 text-[#00AFCC]">
                  ({POSITIONS.find((p) => p.id === pendingPos)?.label})
                </span>
              </p>
            </div>
            <label
              className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-[#00AFCC] rounded-xl cursor-pointer bg-[#E6F8FC] hover:bg-[#D0F2FA] transition-colors"
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              onDragOver={(e) => e.preventDefault()}
            >
              <span className="text-2xl">🖼</span>
              <span className="text-xs font-semibold text-[#00AFCC] mt-1">クリックまたはドロップ</span>
              <span className="text-[10px] text-[#00AFCC]/70 mt-0.5">JPG / PNG / WebP / GIF</span>
              <input
                ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
              />
            </label>
          </div>
        )}

        <p className="text-[10px] text-gray-400 leading-relaxed">
          挿入後にその画像をクリックするとサイズ・配置などを編集できます。Ctrl+Z でUndo可能。
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  selectedElement: SelectedElement | null;
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

export default function ImageInsertPanel({
  selectedElement,
  html,
  onUpdate,
  onDeselect,
}: Props) {
  /** data-element-id を持つ要素クリック（挿入済み画像 or ギャラリーimg）
   * NOTE: img タグ以外の要素（freeblock section など）が data-element-id を持っていても
   * InsertedImageEditPanel に誤ルーティングしないよう tagName チェックを行う。
   */
  const insertedImageId = useMemo(() => {
    if (!selectedElement) return null;
    // img 要素以外は挿入済み画像として扱わない
    if (selectedElement.tagName !== "img") return null;
    const m = selectedElement.selector.match(/\[data-element-id="([^"]+)"\]/);
    return m ? m[1] : null;
  }, [selectedElement]);

  /** imgblock セクション内の要素をクリックしたか
   * NOTE: data-element-id が付与されると selector が変わるため、
   * lpClasses / parentSectionLpClasses でもフォールバック検出する。
   */
  const isImgBlock =
    !!selectedElement?.selector?.startsWith(".lp-imgblock") ||
    !!selectedElement?.lpClasses?.some((c) => c.startsWith("lp-imgblock")) ||
    !!selectedElement?.parentSectionLpClasses?.includes("lp-imgblock");

  /** 複数 imgblock を区別するための一意クラス（例: "lp-imgblock_abc123"）
   * lpClasses → parentSectionLpClasses の順で探す。旧形式（一意クラスなし）は null。
   */
  const imgBlockUniqueClass = useMemo((): string | null => {
    if (!selectedElement) return null;
    const allClasses = [
      ...(selectedElement.lpClasses ?? []),
      ...(selectedElement.parentSectionLpClasses ?? []),
    ];
    return allClasses.find((c) => c.startsWith("lp-imgblock_")) ?? null;
  }, [selectedElement]);

  /** お客様の声カードをクリックしたか */
  const voiceCardElementId = useMemo((): string | null => {
    if (selectedElement?.selector === ".lp-voice-card") {
      return selectedElement.elementId ?? null;
    }
    return null;
  }, [selectedElement]);

  /** Before/After 画像プレースホルダーをクリックしたか */
  const beforeAfterElementId = useMemo((): string | null => {
    if (
      selectedElement?.type === "img-placeholder" ||
      selectedElement?.selector?.includes("lp-ba-img")
    ) {
      return selectedElement.elementId ?? null;
    }
    return null;
  }, [selectedElement]);

  /** ギャラリーアイテム（div or img）をクリックしたか */
  const galleryElementId = useMemo((): string | null => {
    if (!selectedElement) return null;
    // .lp-gallery-item div がクリックされた場合（elementId が div に付く）
    if (selectedElement.selector?.startsWith(".lp-gallery-item")) {
      return selectedElement.elementId ?? null;
    }
    // img がクリックされた場合（selector が [data-element-id="..."]）
    if (insertedImageId && isGalleryElement(html, insertedImageId)) {
      return insertedImageId;
    }
    return null;
  }, [selectedElement, insertedImageId, html]);

  return (
    <div className="flex flex-col h-full">
      {/* ─── 挿入/編集エリア ─── */}
      <div className="flex flex-col flex-1 min-h-0">
        {beforeAfterElementId ? (
          <BeforeAfterImageEditPanel
            elementId={beforeAfterElementId}
            html={html}
            onUpdate={onUpdate}
            onDeselect={onDeselect}
          />
        ) : voiceCardElementId ? (
          <VoiceCardEditPanel
            elementId={voiceCardElementId}
            html={html}
            onUpdate={onUpdate}
            onDeselect={onDeselect}
          />
        ) : galleryElementId ? (
          <GalleryItemEditPanel
            elementId={galleryElementId}
            html={html}
            onUpdate={onUpdate}
            onDeselect={onDeselect}
          />
        ) : insertedImageId ? (
          <InsertedImageEditPanel
            imageId={insertedImageId}
            html={html}
            onUpdate={onUpdate}
            onDeselect={onDeselect}
          />
        ) : isImgBlock ? (
          <ImgBlockEditPanel
            html={html}
            uniqueClass={imgBlockUniqueClass}
            onUpdate={onUpdate}
            onDeselect={onDeselect}
          />
        ) : selectedElement ? (
          <InsertFlow
            selectedElement={selectedElement}
            html={html}
            onUpdate={onUpdate}
            onDeselect={onDeselect}
          />
        ) : (
          /* ヒント */
          <div className="flex flex-col items-center justify-center flex-1 p-5 text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#E6F8FC] flex items-center justify-center text-2xl">
              📷
            </div>
            <div>
              <p className="text-sm font-bold text-gray-700">画像挿入モード</p>
              <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                プレビュー内の要素をクリックして<br />
                挿入位置を選んでください
              </p>
            </div>
            <div className="text-left w-full space-y-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl p-3">
              {["見出しの上 / 下", "本文と本文の間", "CTAボタンの上", "チェックリストの途中", "セクション末尾"].map((t) => (
                <div key={t} className="flex items-center gap-2">
                  <span className="text-[#00AFCC]">•</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
