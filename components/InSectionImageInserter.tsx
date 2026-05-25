"use client";

import { useState, useRef } from "react";
import { SortableSection } from "@/components/SectionSorter";

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsertPosition = "heading_below" | "section_end";
export type InsertAlignment = "left" | "center" | "right";

export interface InsertImageConfig {
  alt: string;
  width: string;        // "50%" | "80%" | "100%" | custom e.g. "400px"
  borderRadius: number; // px
  marginV: number;      // px (上下余白)
  alignment: InsertAlignment;
}

// ─── HTML insertion utility ───────────────────────────────────────────────────

export function insertImageIntoHtml(
  html: string,
  sectionId: string,
  position: InsertPosition,
  imageUrl: string,
  config: InsertImageConfig,
): string {
  if (typeof window === "undefined") return html;

  const doc = new DOMParser().parseFromString(html, "text/html");
  const section = doc.querySelector(`.lp-${sectionId}`);
  if (!section) return html;

  const wrapperStyle = [
    `text-align:${config.alignment}`,
    `margin-top:${config.marginV}px`,
    `margin-bottom:${config.marginV}px`,
  ].join(";");

  const imgStyle = [
    `width:${config.width}`,
    "max-width:100%",
    "height:auto",
    "display:inline-block",
    "vertical-align:top",
    `border-radius:${config.borderRadius}px`,
  ].join(";");

  const wrapper = doc.createElement("div");
  wrapper.className = "lp-section-img";
  wrapper.setAttribute("style", wrapperStyle);

  const img = doc.createElement("img");
  img.src = imageUrl;
  img.alt = config.alt;
  img.setAttribute("style", imgStyle);
  wrapper.appendChild(img);

  if (position === "heading_below") {
    const heading = section.querySelector("h1,h2,h3,h4");
    if (heading) {
      heading.insertAdjacentElement("afterend", wrapper);
    } else {
      // 見出しがない場合はセクション先頭に挿入
      section.insertBefore(wrapper, section.firstChild);
    }
  } else {
    // section_end
    section.appendChild(wrapper);
  }

  return doc.body.innerHTML;
}

// ─── Component ───────────────────────────────────────────────────────────────

interface Props {
  sectionOrder: SortableSection[];
  html: string;
  onInsert: (newHtml: string) => void;
}

const WIDTH_PRESETS = ["50%", "80%", "100%"] as const;

export default function InSectionImageInserter({ sectionOrder, html, onInsert }: Props) {
  const [selectedSection, setSelectedSection] = useState<string>(sectionOrder[0]?.id ?? "");
  const [position, setPosition] = useState<InsertPosition>("heading_below");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [alt, setAlt] = useState<string>("");
  const [width, setWidth] = useState<string>("80%");
  const [borderRadius, setBorderRadius] = useState<number>(8);
  const [marginV, setMarginV] = useState<number>(16);
  const [alignment, setAlignment] = useState<InsertAlignment>("center");

  const fileRef = useRef<HTMLInputElement>(null);

  // ─── Image load ──────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageUrl(e.target?.result as string);
      setImageName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) handleFile(file);
  };

  const clearImage = () => {
    setImageUrl(null);
    setImageName("");
    if (fileRef.current) fileRef.current.value = "";
  };

  // ─── Insert ──────────────────────────────────────────────────────────────

  const handleInsert = () => {
    if (!imageUrl || !selectedSection) return;
    const newHtml = insertImageIntoHtml(html, selectedSection, position, imageUrl, {
      alt,
      width,
      borderRadius,
      marginV,
      alignment,
    });
    onInsert(newHtml);
    clearImage();
  };

  // ─── Render ──────────────────────────────────────────────────────────────

  if (sectionOrder.length === 0) {
    return <p className="text-xs text-gray-400">LPを生成するとセクション一覧が表示されます。</p>;
  }

  return (
    <div className="space-y-4">

      {/* ① 挿入先セクション */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">挿入先セクション</label>
        <select
          value={selectedSection}
          onChange={(e) => setSelectedSection(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#00AFCC]"
        >
          {sectionOrder.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      {/* ② 挿入位置 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">挿入位置</label>
        <div className="flex gap-2">
          {(
            [
              { id: "heading_below", label: "見出しの下" },
              { id: "section_end",  label: "セクション末尾" },
            ] as { id: InsertPosition; label: string }[]
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => setPosition(p.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors
                ${position === p.id
                  ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                  : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"}`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ③ 画像アップロード */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">画像</label>
        {imageUrl ? (
          <div className="relative rounded-lg overflow-hidden border border-gray-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imageUrl} alt="プレビュー" className="w-full h-28 object-cover" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1 text-[10px] text-white truncate">
              {imageName}
            </div>
            <button
              onClick={clearImage}
              className="absolute top-1 right-1 w-6 h-6 bg-white rounded-full shadow text-gray-500 text-xs flex items-center justify-center hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              ✕
            </button>
          </div>
        ) : (
          <label
            className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-[#00AFCC] hover:bg-[#E6F8FC] transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <span className="text-2xl">🖼</span>
            <span className="text-xs text-gray-400 mt-1">クリックまたはドロップ</span>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </label>
        )}
      </div>

      {/* ④ altテキスト */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">altテキスト</label>
        <input
          type="text"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          placeholder="画像の説明（省略可）"
          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#00AFCC]"
        />
      </div>

      {/* ⑤ 横幅 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">横幅</label>
        <div className="flex gap-1.5">
          {WIDTH_PRESETS.map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors
                ${width === w
                  ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                  : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"}`}
            >
              {w}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={WIDTH_PRESETS.includes(width as typeof WIDTH_PRESETS[number]) ? "" : width}
          onChange={(e) => setWidth(e.target.value)}
          placeholder="カスタム (例: 400px)"
          className="mt-1.5 w-full rounded-lg border border-gray-200 px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#00AFCC] placeholder-gray-300"
        />
      </div>

      {/* ⑥ 配置 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">配置</label>
        <div className="flex gap-1.5">
          {(
            [
              { id: "left", label: "← 左" },
              { id: "center", label: "中央" },
              { id: "right", label: "右 →" },
            ] as { id: InsertAlignment; label: string }[]
          ).map((a) => (
            <button
              key={a.id}
              onClick={() => setAlignment(a.id)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border transition-colors
                ${alignment === a.id
                  ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                  : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"}`}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* ⑦ 角丸 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-gray-600">角丸</label>
          <span className="text-xs text-gray-400">{borderRadius}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          value={borderRadius}
          onChange={(e) => setBorderRadius(Number(e.target.value))}
          className="w-full accent-[#00AFCC]"
        />
      </div>

      {/* ⑧ 上下余白 */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-semibold text-gray-600">上下余白</label>
          <span className="text-xs text-gray-400">{marginV}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={64}
          value={marginV}
          onChange={(e) => setMarginV(Number(e.target.value))}
          className="w-full accent-[#00AFCC]"
        />
      </div>

      {/* ⑨ 挿入ボタン */}
      <button
        onClick={handleInsert}
        disabled={!imageUrl || !selectedSection}
        className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl transition-all shadow-sm"
      >
        📌 セクションに画像を挿入
      </button>

      {/* ヒント */}
      <p className="text-[10px] text-gray-400 leading-relaxed">
        挿入後はプレビューに即時反映されます。Undo（Ctrl+Z）で元に戻せます。
      </p>
    </div>
  );
}
