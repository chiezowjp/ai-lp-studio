"use client";

import React, { useMemo, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type FbElType = "heading" | "text" | "button" | "image";

export interface FbElement {
  id: string; // data-lp-fb-el-id
  type: FbElType;
  /** inner text content or img src (image type) */
  content: string;
  /** href URL for button type */
  link?: string;
}

// ─── Selector Helpers ─────────────────────────────────────────────────────────

/**
 * selector（例: ".lp-freeblock_abc123.lp-freeblock" または ".lp-freeblock"）から
 * 一意クラス名を抽出する。旧形式（一意クラスなし）の場合は null を返す。
 */
export function extractFbUniqueClass(selector: string): string | null {
  const m = selector.match(/\.lp-freeblock_([a-z0-9]+)/);
  return m ? `lp-freeblock_${m[1]}` : null;
}

/**
 * 一意クラスまたはフォールバックで .lp-fb-inner を取得。
 * 旧形式（uniqueClass=null）は最初の .lp-fb-inner にフォールバック。
 */
function getFbInner(doc: Document, uniqueClass: string | null): Element | null {
  if (uniqueClass) {
    return doc.querySelector(`.${uniqueClass} .lp-fb-inner`);
  }
  return doc.querySelector(".lp-freeblock .lp-fb-inner");
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

/** Parse free-block elements from the current HTML string */
export function parseFbElements(html: string, uniqueClass: string | null): FbElement[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const inner = getFbInner(doc, uniqueClass);
  if (!inner) return [];

  const els: FbElement[] = [];
  Array.from(inner.children).forEach((child) => {
    const el = child as HTMLElement;
    const type = el.getAttribute("data-lp-fb-el") as FbElType | null;
    if (!type) return;
    const id = el.getAttribute("data-lp-fb-el-id") ?? newId();

    let content = "";
    let link: string | undefined;
    if (type === "image") {
      const img = el.querySelector("img");
      content = img?.getAttribute("src") ?? "";
    } else {
      content = el.textContent?.trim() ?? "";
    }
    if (type === "button") {
      const href = (el as HTMLAnchorElement).getAttribute("href") ?? "";
      link = href === "#" ? "" : href;
    }
    els.push({ id, type, content, link });
  });
  return els;
}

/** Generate a random id for a new fb element */
function newId() {
  return "fb-" + Math.random().toString(36).slice(2, 9);
}

/** Build HTML string for a single fb element */
function renderFbEl(el: FbElement): string {
  const id = el.id;
  switch (el.type) {
    case "heading":
      return `<h2 class="lp-fb-heading" data-lp-fb-el="heading" data-lp-fb-el-id="${id}">${el.content || "見出しテキスト"}</h2>`;
    case "text":
      return `<p class="lp-fb-text" data-lp-fb-el="text" data-lp-fb-el-id="${id}">${el.content || "本文テキストをここに入力してください。"}</p>`;
    case "button":
      return `<a class="lp-fb-btn" href="${el.link || "#"}" data-lp-fb-el="button" data-lp-fb-el-id="${id}">${el.content || "ボタンテキスト"}</a>`;
    case "image":
      if (el.content) {
        return `<div class="lp-fb-img-wrap" data-lp-fb-el="image" data-lp-fb-el-id="${id}"><img src="${el.content}" alt="" style="max-width:100%;height:auto;border-radius:8px;display:block;" /></div>`;
      }
      return `<div class="lp-fb-img-wrap" data-lp-fb-el="image" data-lp-fb-el-id="${id}" style="min-height:80px;border:2px dashed #d1d5db;border-radius:8px;"></div>`;
    default:
      return "";
  }
}

/** Re-serialize all fb elements back into the HTML string */
function serializeFbElements(html: string, elements: FbElement[], uniqueClass: string | null): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const inner = getFbInner(doc, uniqueClass);
  if (!inner) return html;
  inner.innerHTML = elements.map(renderFbEl).join("\n  ");
  return doc.body.innerHTML;
}

/** Add a new element at the end */
export function addFbElement(html: string, type: FbElType, uniqueClass: string | null): string {
  const els = parseFbElements(html, uniqueClass);
  els.push({ id: newId(), type, content: "" });
  return serializeFbElements(html, els, uniqueClass);
}

/** Remove element by id */
export function removeFbElement(html: string, elId: string, uniqueClass: string | null): string {
  const els = parseFbElements(html, uniqueClass).filter((e) => e.id !== elId);
  return serializeFbElements(html, els, uniqueClass);
}

// ─── Section Style Helpers ────────────────────────────────────────────────────

/** freeblock セクションの背景色を取得（hex, rgb, rgba, named color など）。
 *  input[type=color] 用に hex6 へ変換する。変換できなければ "#ffffff" を返す。 */
export function getFbBgColor(html: string, uniqueClass: string | null): string {
  if (typeof window === "undefined") return "#ffffff";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const section = uniqueClass
    ? doc.querySelector(`.${uniqueClass}`)
    : doc.querySelector(".lp-freeblock");
  if (!section) return "#ffffff";
  const attrStyle = section.getAttribute("style") ?? "";
  const match = attrStyle.match(/background(?:-color)?:\s*([^;]+)/i);
  if (!match) return "#ffffff";
  const colorVal = match[1].trim();
  if (/^#[0-9a-f]{6}$/i.test(colorVal)) return colorVal.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(colorVal)) {
    const [, r, g, b] = colorVal.match(/^#(.)(.)(.)$/)!;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  // canvas でその他フォーマット（rgb/rgba/named）→ hex に変換
  try {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = colorVal;
    ctx.fillRect(0, 0, 1, 1);
    const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
    return "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
  } catch {
    return "#ffffff";
  }
}

/** freeblock セクションの背景色を更新して HTML を返す */
export function setFbBgColor(html: string, uniqueClass: string | null, color: string): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const section = uniqueClass
    ? doc.querySelector(`.${uniqueClass}`)
    : doc.querySelector(".lp-freeblock");
  if (!section) return html;
  const attrStyle = section.getAttribute("style") ?? "";
  // 既存の background / background-color を除去して新しい値を追加
  let newStyle = attrStyle.replace(/background(?:-color)?:\s*[^;]+;?\s*/gi, "").trim();
  if (newStyle && !newStyle.endsWith(";")) newStyle += ";";
  if (color && color.toLowerCase() !== "#ffffff") {
    newStyle = `${newStyle} background-color:${color};`.trim();
  }
  if (newStyle) {
    section.setAttribute("style", newStyle);
  } else {
    section.removeAttribute("style");
  }
  return doc.body.innerHTML;
}

/** Move element up or down */
export function moveFbElement(html: string, elId: string, dir: "up" | "down", uniqueClass: string | null): string {
  const els = parseFbElements(html, uniqueClass);
  const idx = els.findIndex((e) => e.id === elId);
  if (idx < 0) return html;
  if (dir === "up" && idx === 0) return html;
  if (dir === "down" && idx === els.length - 1) return html;
  const newEls = [...els];
  const swapIdx = dir === "up" ? idx - 1 : idx + 1;
  [newEls[idx], newEls[swapIdx]] = [newEls[swapIdx], newEls[idx]];
  return serializeFbElements(html, newEls, uniqueClass);
}

/** Update content and/or link of a specific element */
export function updateFbElement(
  html: string,
  elId: string,
  patch: string | Partial<Pick<FbElement, "content" | "link">>,
  uniqueClass: string | null,
): string {
  const update = typeof patch === "string" ? { content: patch } : patch;
  const els = parseFbElements(html, uniqueClass).map((e) =>
    e.id === elId ? { ...e, ...update } : e
  );
  return serializeFbElements(html, els, uniqueClass);
}

// ─── Sub-component: Element Row ───────────────────────────────────────────────

interface ElementRowProps {
  el: FbElement;
  idx: number;
  total: number;
  html: string;
  uniqueClass: string | null;
  onUpdate: (newHtml: string) => void;
}

const TYPE_LABELS: Record<FbElType, { icon: string; label: string }> = {
  heading: { icon: "H", label: "見出し" },
  text: { icon: "¶", label: "本文" },
  button: { icon: "▶", label: "ボタン" },
  image: { icon: "🖼", label: "画像" },
};

function ElementRow({ el, idx, total, html, uniqueClass, onUpdate }: ElementRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(el.content);
  const [draftLink, setDraftLink] = useState(el.link ?? "");
  const fileRef = useRef<HTMLInputElement>(null);
  const meta = TYPE_LABELS[el.type];

  // リセット: el が外部から変化したときにドラフトを同期
  const prevId = useRef(el.id);
  if (prevId.current !== el.id) {
    prevId.current = el.id;
    setDraft(el.content);
    setDraftLink(el.link ?? "");
  }

  const handleMove = (dir: "up" | "down") => onUpdate(moveFbElement(html, el.id, dir, uniqueClass));
  const handleRemove = () => onUpdate(removeFbElement(html, el.id, uniqueClass));

  const handleImageFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => onUpdate(updateFbElement(html, el.id, e.target?.result as string, uniqueClass));
    reader.readAsDataURL(file);
  };

  const handleTextSave = () => {
    onUpdate(updateFbElement(html, el.id, { content: draft, link: draftLink }, uniqueClass));
    setEditing(false);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-xl overflow-hidden">
      {/* Row header */}
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="w-7 h-7 rounded-lg bg-[#E6F8FC] text-[#00AFCC] text-[11px] font-bold flex items-center justify-center shrink-0">
          {meta.icon}
        </span>
        <span className="flex-1 text-xs text-gray-700 font-medium truncate">
          {meta.label}
          {el.type !== "image" && el.content && (
            <span className="text-gray-400 font-normal ml-1">— {el.content.slice(0, 18)}</span>
          )}
        </span>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => { setDraft(el.content); setDraftLink(el.link ?? ""); setEditing((v) => !v); }}
            className="w-6 h-6 rounded text-gray-400 hover:text-[#00AFCC] hover:bg-[#E6F8FC] flex items-center justify-center text-xs transition-colors"
            title="編集"
          >
            ✏️
          </button>
          <button
            onClick={() => handleMove("up")}
            disabled={idx === 0}
            className="w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 flex items-center justify-center text-xs transition-colors"
            title="上へ"
          >
            ▲
          </button>
          <button
            onClick={() => handleMove("down")}
            disabled={idx === total - 1}
            className="w-6 h-6 rounded text-gray-400 hover:text-gray-700 hover:bg-gray-200 disabled:opacity-25 flex items-center justify-center text-xs transition-colors"
            title="下へ"
          >
            ▼
          </button>
          <button
            onClick={handleRemove}
            className="w-6 h-6 rounded text-red-300 hover:text-red-600 hover:bg-red-50 flex items-center justify-center text-xs transition-colors"
            title="削除"
          >
            🗑
          </button>
        </div>
      </div>

      {/* Expanded edit area */}
      {editing && (
        <div className="border-t border-gray-200 px-3 pb-3 pt-2 space-y-2">
          {el.type === "image" ? (
            <>
              {el.content && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={el.content}
                  alt=""
                  className="w-full h-24 object-contain rounded-lg border border-gray-200 bg-gray-50"
                />
              )}
              <label
                className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#00AFCC] rounded-xl cursor-pointer bg-[#E6F8FC] hover:bg-[#D0F2FA] transition-colors"
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files?.[0];
                  if (f) handleImageFile(f);
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                <span className="text-lg">🖼</span>
                <span className="text-[10px] font-semibold text-[#00AFCC] mt-0.5">
                  {el.content ? "差し替え" : "画像をアップロード"}
                </span>
                <span className="text-[9px] text-[#00AFCC]/70">クリックまたはドロップ</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleImageFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          ) : (
            <>
              {el.type === "heading" || el.type === "button" ? (
                <>
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#00AFCC]"
                    placeholder={el.type === "heading" ? "見出しテキスト" : "ボタンテキスト"}
                    onKeyDown={(e) => { if (e.key === "Enter") handleTextSave(); }}
                  />
                  {el.type === "button" && (
                    <div>
                      <label className="block text-[10px] font-semibold text-gray-500 mb-1">リンクURL</label>
                      <input
                        type="url"
                        value={draftLink}
                        onChange={(e) => setDraftLink(e.target.value)}
                        className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#00AFCC]"
                        placeholder="https://example.com または #section"
                      />
                    </div>
                  )}
                </>
              ) : (
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={3}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-2 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] resize-y"
                  placeholder="本文テキストを入力"
                />
              )}
              <button
                onClick={handleTextSave}
                className="w-full py-1.5 text-[10px] font-bold rounded-lg bg-[#00AFCC] text-white hover:bg-[#0099b3] transition-colors"
              >
                適用
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface FreeBlockPanelProps {
  /** buildSelector が返すセレクター文字列。一意クラスの特定に使用。
   *  例: ".lp-freeblock_abc123.lp-freeblock" または旧形式 ".lp-freeblock" */
  selector: string;
  html: string;
  onUpdate: (newHtml: string) => void;
  /** 背景色（CSS visual styles 経由で管理）。未設定時は "#ffffff" */
  bgColor?: string;
  /** 背景色変更コールバック（CSS visual styles 経由）。未設定時は HTML inline style にフォールバック */
  onBgColorChange?: (color: string) => void;
}

export default function FreeBlockPanel({ selector, html, onUpdate, bgColor: bgColorProp, onBgColorChange }: FreeBlockPanelProps) {
  const uniqueClass = useMemo(() => extractFbUniqueClass(selector), [selector]);
  const elements = useMemo(() => parseFbElements(html, uniqueClass), [html, uniqueClass]);
  // bgColor: 外部 prop（visual styles）が優先。なければ HTML inline style から読み取る（後方互換）
  const bgColorFromHtml = useMemo(() => getFbBgColor(html, uniqueClass), [html, uniqueClass]);
  const bgColor = bgColorProp ?? bgColorFromHtml;

  function handleAdd(type: FbElType) {
    onUpdate(addFbElement(html, type, uniqueClass));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">⬜</span>
          <div>
            <p className="text-sm font-bold text-gray-800">空セクション編集</p>
            <p className="text-xs text-gray-400">要素を追加して自由にレイアウト</p>
          </div>
        </div>
      </div>

      {/* Section style */}
      <div className="shrink-0 px-4 py-3 border-b border-gray-100">
        <p className="text-[11px] font-semibold text-gray-500 mb-2">セクションスタイル</p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600 w-16 shrink-0">背景色</label>
          <div className="relative">
            <input
              type="color"
              value={bgColor}
              onChange={(e) => {
                if (onBgColorChange) {
                  onBgColorChange(e.target.value);
                } else {
                  onUpdate(setFbBgColor(html, uniqueClass, e.target.value));
                }
              }}
              className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5 bg-white"
              title={bgColor}
            />
            {bgColor !== "#ffffff" && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-white" />
            )}
          </div>
          <span className="text-[10px] text-gray-400 font-mono">{bgColor}</span>
          {bgColor !== "#ffffff" && (
            <button
              onClick={() => {
                if (onBgColorChange) {
                  onBgColorChange("#ffffff");
                } else {
                  onUpdate(setFbBgColor(html, uniqueClass, "#ffffff"));
                }
              }}
              className="text-[10px] text-gray-400 hover:text-red-500 ml-auto shrink-0"
              title="リセット"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Element list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {elements.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400">
            <div className="text-3xl mb-2">⬜</div>
            <p>下のボタンで要素を追加してください</p>
          </div>
        )}

        {elements.map((el, idx) => (
          <ElementRow
            key={el.id}
            el={el}
            idx={idx}
            total={elements.length}
            html={html}
            uniqueClass={uniqueClass}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {/* Add buttons */}
      <div className="shrink-0 border-t border-gray-100 px-4 py-3">
        <p className="text-[11px] text-gray-400 mb-2">要素を追加</p>
        <div className="grid grid-cols-2 gap-2">
          {(["heading", "text", "button", "image"] as FbElType[]).map((type) => {
            const meta = TYPE_LABELS[type];
            return (
              <button
                key={type}
                onClick={() => handleAdd(type)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 hover:border-[#00AFCC] hover:bg-[#E6F8FC] text-xs text-gray-600 hover:text-[#00AFCC] transition-colors font-medium"
              >
                <span className="w-5 h-5 rounded bg-[#E6F8FC] text-[#00AFCC] text-[10px] font-bold flex items-center justify-center shrink-0">
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
