"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { SortableSection } from "@/components/SectionSorter";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ImageBlock {
  id: string;
  url: string;
  alt: string;
  width: string;
  alignment: "left" | "center" | "right";
  borderRadius: number;
  marginV: number;
}

const WIDTH_PRESETS = ["50%", "80%", "100%"] as const;

// ─── DOM utilities ────────────────────────────────────────────────────────────

function buildWrapperEl(doc: Document, block: ImageBlock): HTMLElement {
  const wrapper = doc.createElement("div");
  wrapper.className = "lp-section-img";
  wrapper.setAttribute("data-block-id", block.id);
  wrapper.setAttribute(
    "style",
    [
      `text-align:${block.alignment}`,
      `margin-top:${block.marginV}px`,
      `margin-bottom:${block.marginV}px`,
    ].join(";"),
  );

  const img = doc.createElement("img");
  img.src = block.url;
  img.alt = block.alt;
  img.setAttribute(
    "style",
    [
      `width:${block.width}`,
      "max-width:100%",
      "height:auto",
      "display:inline-block",
      "vertical-align:top",
      `border-radius:${block.borderRadius}px`,
    ].join(";"),
  );
  wrapper.appendChild(img);
  return wrapper;
}

export function parseImageBlocks(html: string, sectionId: string): ImageBlock[] {
  if (typeof window === "undefined") return [];
  const doc = new DOMParser().parseFromString(html, "text/html");
  const section = doc.querySelector(`.lp-${sectionId}`);
  if (!section) return [];

  return Array.from(section.querySelectorAll(".lp-section-img")).flatMap((wrapper) => {
    const img = wrapper.querySelector("img");
    if (!img) return [];
    const ws = wrapper.getAttribute("style") ?? "";
    const is = img.getAttribute("style") ?? "";
    return [
      {
        id:
          wrapper.getAttribute("data-block-id") ??
          `blk-${Math.random().toString(36).slice(2)}`,
        url: img.src,
        alt: img.alt ?? "",
        width: is.match(/width:([^;]+)/)?.[1]?.trim() ?? "80%",
        alignment: (ws.match(/text-align:\s*(left|center|right)/)?.[1] ??
          "center") as ImageBlock["alignment"],
        borderRadius: parseInt(is.match(/border-radius:(\d+)px/)?.[1] ?? "8", 10),
        marginV: parseInt(ws.match(/margin-top:\s*(\d+)px/)?.[1] ?? "16", 10),
      },
    ];
  });
}

export function applyImageBlocksToHtml(
  html: string,
  sectionId: string,
  blocks: ImageBlock[],
): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const section = doc.querySelector(`.lp-${sectionId}`);
  if (!section) return html;

  // 既存ラッパー群の末尾の次ノードを挿入基点として記録
  const wrappers = Array.from(section.querySelectorAll(".lp-section-img"));
  const lastWrapper = wrappers[wrappers.length - 1];
  const anchorParent: Element = lastWrapper?.parentElement ?? section;
  // 全ラッパーの後ろにある最初の非ラッパーノード（= グループ末尾の次）
  let anchorRef: Node | null = lastWrapper?.nextSibling ?? null;
  while (
    anchorRef &&
    (anchorRef as Element).classList?.contains("lp-section-img")
  ) {
    anchorRef = anchorRef.nextSibling;
  }

  // 既存ラッパーを除去
  wrappers.forEach((w) => w.remove());

  // 新ブロックを挿入
  blocks
    .map((b) => buildWrapperEl(doc, b))
    .forEach((w) => {
      if (anchorRef && anchorParent.contains(anchorRef)) {
        anchorParent.insertBefore(w, anchorRef);
      } else {
        anchorParent.appendChild(w);
      }
    });

  return doc.body.innerHTML;
}

// ─── EditPanel ────────────────────────────────────────────────────────────────

interface EditPanelProps {
  block: ImageBlock;
  onChange: (partial: Partial<ImageBlock>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
}

function EditPanel({ block, onChange, onDelete, onDuplicate }: EditPanelProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-3 border-t border-gray-100">
      {/* 配置 */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">配置</label>
        <div className="flex gap-1">
          {(["left", "center", "right"] as ImageBlock["alignment"][]).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ alignment: a })}
              className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-colors ${
                block.alignment === a
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
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">横幅</label>
        <div className="flex gap-1 mb-1">
          {WIDTH_PRESETS.map((w) => (
            <button
              key={w}
              onClick={() => onChange({ width: w })}
              className={`flex-1 py-1 text-[10px] font-semibold rounded border transition-colors ${
                block.width === w
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
          value={
            WIDTH_PRESETS.includes(block.width as (typeof WIDTH_PRESETS)[number])
              ? ""
              : block.width
          }
          onChange={(e) => onChange({ width: e.target.value })}
          placeholder="例: 320px"
          className="w-full text-[10px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
        />
      </div>

      {/* 角丸 */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-500">角丸</label>
          <span className="text-[10px] text-gray-400">{block.borderRadius}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={40}
          value={block.borderRadius}
          onChange={(e) => onChange({ borderRadius: Number(e.target.value) })}
          className="w-full accent-[#00AFCC]"
        />
      </div>

      {/* 上下余白 */}
      <div>
        <div className="flex justify-between mb-1">
          <label className="text-[10px] font-semibold text-gray-500">上下余白</label>
          <span className="text-[10px] text-gray-400">{block.marginV}px</span>
        </div>
        <input
          type="range"
          min={0}
          max={64}
          value={block.marginV}
          onChange={(e) => onChange({ marginV: Number(e.target.value) })}
          className="w-full accent-[#00AFCC]"
        />
      </div>

      {/* alt テキスト */}
      <div>
        <label className="block text-[10px] font-semibold text-gray-500 mb-1">
          altテキスト
        </label>
        <input
          type="text"
          value={block.alt}
          onChange={(e) => onChange({ alt: e.target.value })}
          placeholder="画像の説明（省略可）"
          className="w-full text-[10px] border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] placeholder-gray-300"
        />
      </div>

      {/* アクション */}
      <div className="flex gap-1.5 pt-1 border-t border-gray-100">
        <button
          onClick={onDuplicate}
          className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-[#00AFCC] hover:text-[#00AFCC] transition-colors"
        >
          複製
        </button>
        <button
          onClick={onDelete}
          className="flex-1 py-1.5 text-[10px] font-semibold rounded-lg border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
        >
          削除
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  sectionOrder: SortableSection[];
  html: string;
  onUpdate: (newHtml: string) => void;
}

export default function ImageBlockEditor({ sectionOrder, html, onUpdate }: Props) {
  const [selectedSection, setSelectedSection] = useState<string>(
    sectionOrder[0]?.id ?? "",
  );
  const [blocks, setBlocks] = useState<ImageBlock[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  // refs で最新値を保持（stale closure 対策）
  const htmlRef = useRef(html);
  htmlRef.current = html;
  const sectionRef = useRef(selectedSection);
  sectionRef.current = selectedSection;
  // このコンポーネント自身が HTML を更新したか追跡
  const isLocalUpdate = useRef(false);

  // html / selectedSection が変わったらブロックを再パース（外部変更 = undo など）
  useEffect(() => {
    if (isLocalUpdate.current) {
      isLocalUpdate.current = false;
      return;
    }
    if (!selectedSection) return;
    setBlocks(parseImageBlocks(html, selectedSection));
  }, [html, selectedSection]);

  // ブロック一覧を確定して HTML を更新
  const commit = useCallback(
    (newBlocks: ImageBlock[]) => {
      isLocalUpdate.current = true;
      setBlocks(newBlocks);
      onUpdate(applyImageBlocksToHtml(htmlRef.current, sectionRef.current, newBlocks));
    },
    [onUpdate],
  );

  // ── 操作 ─────────────────────────────────────────────────────────────────

  const moveBlock = (id: string, dir: -1 | 1) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      isLocalUpdate.current = true;
      onUpdate(applyImageBlocksToHtml(htmlRef.current, sectionRef.current, next));
      return next;
    });
  };

  const deleteBlock = (id: string) => {
    if (editingId === id) setEditingId(null);
    setBlocks((prev) => {
      const next = prev.filter((b) => b.id !== id);
      isLocalUpdate.current = true;
      onUpdate(applyImageBlocksToHtml(htmlRef.current, sectionRef.current, next));
      return next;
    });
  };

  const duplicateBlock = (id: string) => {
    setBlocks((prev) => {
      const idx = prev.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const copy: ImageBlock = {
        ...prev[idx],
        id: `blk-${Math.random().toString(36).slice(2)}`,
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      isLocalUpdate.current = true;
      onUpdate(applyImageBlocksToHtml(htmlRef.current, sectionRef.current, next));
      return next;
    });
  };

  const updateBlock = (id: string, partial: Partial<ImageBlock>) => {
    setBlocks((prev) => {
      const next = prev.map((b) => (b.id === id ? { ...b, ...partial } : b));
      isLocalUpdate.current = true;
      onUpdate(applyImageBlocksToHtml(htmlRef.current, sectionRef.current, next));
      return next;
    });
  };

  const handleFile = (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const newBlock: ImageBlock = {
        id: `blk-${Math.random().toString(36).slice(2)}`,
        url: e.target?.result as string,
        alt: "",
        width: "80%",
        alignment: "center",
        borderRadius: 8,
        marginV: 16,
      };
      setBlocks((prev) => {
        const next = [...prev, newBlock];
        isLocalUpdate.current = true;
        onUpdate(applyImageBlocksToHtml(htmlRef.current, sectionRef.current, next));
        return next;
      });
      setEditingId(newBlock.id);
    };
    reader.readAsDataURL(file);
  };

  // ── Render ───────────────────────────────────────────────────────────────

  if (sectionOrder.length === 0) {
    return (
      <p className="text-xs text-gray-400">
        LPを生成するとセクション一覧が表示されます。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* セクション選択 */}
      <div>
        <label className="block text-xs font-semibold text-gray-600 mb-1">
          対象セクション
        </label>
        <select
          value={selectedSection}
          onChange={(e) => {
            setSelectedSection(e.target.value);
            setEditingId(null);
          }}
          className="w-full rounded-lg border border-gray-300 px-2.5 py-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#00AFCC]"
        >
          {sectionOrder.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* ブロック一覧 */}
      {blocks.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold text-gray-500 flex items-center gap-1">
            <span>🖼</span>
            {blocks.length}枚の画像ブロック
          </p>

          {blocks.map((block, idx) => (
            <div
              key={block.id}
              className={`rounded-xl border overflow-hidden bg-white transition-all ${
                editingId === block.id
                  ? "border-[#00AFCC] shadow-sm"
                  : "border-gray-200"
              }`}
            >
              {/* ブロック行 */}
              <div className="flex items-center gap-2 p-2.5">
                {/* サムネイル */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={block.url}
                  alt={block.alt || "画像"}
                  className="w-12 h-10 object-cover rounded-lg border border-gray-100 shrink-0 cursor-pointer"
                  onClick={() =>
                    setEditingId(editingId === block.id ? null : block.id)
                  }
                />

                {/* 情報（クリックで編集トグル） */}
                <div
                  className="flex-1 min-w-0 cursor-pointer"
                  onClick={() =>
                    setEditingId(editingId === block.id ? null : block.id)
                  }
                >
                  <p className="text-[10px] font-semibold text-gray-700 truncate">
                    {block.alt || "（altなし）"}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {block.width} · {block.alignment}
                  </p>
                </div>

                {/* コントロール */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={() => moveBlock(block.id, -1)}
                    disabled={idx === 0}
                    title="上へ"
                    className="w-6 h-6 flex items-center justify-center text-[11px] text-gray-400 hover:text-indigo-600 disabled:opacity-20 rounded transition-colors"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => moveBlock(block.id, 1)}
                    disabled={idx === blocks.length - 1}
                    title="下へ"
                    className="w-6 h-6 flex items-center justify-center text-[11px] text-gray-400 hover:text-indigo-600 disabled:opacity-20 rounded transition-colors"
                  >
                    ▼
                  </button>
                  <button
                    onClick={() =>
                      setEditingId(editingId === block.id ? null : block.id)
                    }
                    title="編集"
                    className={`w-6 h-6 flex items-center justify-center text-[12px] rounded transition-colors ${
                      editingId === block.id
                        ? "text-[#00AFCC]"
                        : "text-gray-400 hover:text-[#00AFCC]"
                    }`}
                  >
                    ✎
                  </button>
                </div>
              </div>

              {/* 編集パネル（選択時のみ展開） */}
              {editingId === block.id && (
                <EditPanel
                  block={block}
                  onChange={(partial) => updateBlock(block.id, partial)}
                  onDelete={() => deleteBlock(block.id)}
                  onDuplicate={() => duplicateBlock(block.id)}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 text-center py-2 bg-gray-50 rounded-lg">
          このセクションに画像ブロックはありません
        </p>
      )}

      {/* 画像追加エリア */}
      <label
        className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-xl cursor-pointer hover:border-[#00AFCC] hover:bg-[#E6F8FC] transition-colors"
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) handleFile(f);
        }}
        onDragOver={(e) => e.preventDefault()}
      >
        <span className="text-xl">🖼</span>
        <span className="text-[10px] text-gray-400 mt-1">
          クリックまたはドロップで画像を追加
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </label>

      <p className="text-[10px] text-gray-400 leading-relaxed">
        ▲▼で並び替え・✎で編集・Ctrl+Z でUndo可能
      </p>
    </div>
  );
}
