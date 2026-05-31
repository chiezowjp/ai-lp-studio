"use client";

import { useRef, useState } from "react";

export interface SortableSection {
  id: string;
  label: string;
}

interface Props {
  sections: SortableSection[];
  /** ドラッグ・▲▼ 共通：from/to インデックスで並び替えを親に委譲 */
  onReorder: (fromIndex: number, toIndex: number) => void;
  /** セクション名クリック時のコールバック（プレビュースクロール用） */
  onSectionClick?: (id: string) => void;
  /** 現在アクティブ（スクロール先）のセクション ID */
  activeSectionId?: string | null;
  /** 削除リクエストのコールバック */
  onSectionDelete?: (id: string, label: string) => void;
  /** 削除不可のセクション ID セット */
  protectedIds?: Set<string>;
  /** FAQ セクションへの項目追加コールバック */
  onAddFaqItem?: (id: string) => void;
}

/** ドラッグ data-transfer key */
const DT_KEY = "application/x-section-index";

export default function SectionSorter({
  sections,
  onReorder,
  onSectionClick,
  activeSectionId,
  onSectionDelete,
  protectedIds,
  onAddFaqItem,
}: Props) {
  // 視覚フィードバック用 state のみ（並び替えロジックは親に委譲）
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  /**
   * onReorder を常に最新版で参照するための ref。
   * ドラッグ中に React が re-render しても stale closure にならない。
   */
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  if (sections.length === 0) {
    return <p className="text-xs text-gray-400">セクションを検出中…</p>;
  }

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, i: number) => {
    e.dataTransfer.effectAllowed = "move";
    // インデックスを native API で保持（React state/re-render に影響されない）
    e.dataTransfer.setData(DT_KEY, String(i));
    // 視覚更新は rAF で遅延してブラウザのドラッグ画像キャプチャ後に行う
    requestAnimationFrame(() => setDraggingIndex(i));
    console.log("[DRAG] dragStart index:", i, "section:", sections[i]?.id);
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== i) setOverIndex(i);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    const fromStr = e.dataTransfer.getData(DT_KEY);
    const fromIndex = parseInt(fromStr, 10);

    console.log("[DRAG] drop | fromStr:", fromStr, "fromIndex:", fromIndex, "toIndex:", toIndex);

    setDraggingIndex(null);
    setOverIndex(null);

    if (!isNaN(fromIndex) && fromIndex !== toIndex) {
      console.log("[DRAG] calling onReorder(", fromIndex, "→", toIndex, ")");
      onReorderRef.current(fromIndex, toIndex); // 親の処理を呼ぶ（HTML も更新される）
    } else {
      console.log("[DRAG] skipped: fromIndex invalid or same as toIndex");
    }
  };

  const handleDragEnd = () => {
    // drop が発火しなかった場合（キャンセル等）のクリーンアップ
    console.log("[DRAG] dragEnd (drop was not fired or already handled)");
    setDraggingIndex(null);
    setOverIndex(null);
  };

  // ── ▲▼ ボタン ────────────────────────────────────────────────────────────

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    console.log("[MOVE] ▲▼ button | from:", from, "to:", to);
    onReorderRef.current(from, to); // ドラッグと完全に同じ関数を呼ぶ
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-gray-400 mb-2">
        名前クリックでプレビューへ移動・ドラッグまたは矢印で並び替え
      </p>
      <ul className="space-y-1">
        {sections.map((sec, i) => {
          const isDragging = draggingIndex === i;
          const isOver = overIndex === i && draggingIndex !== i;
          const isActive = sec.id === activeSectionId;
          const isProtected = protectedIds?.has(sec.id) ?? false;
          const canDelete = !!onSectionDelete && !isProtected;

          return (
            <li
              key={sec.id}
              draggable
              onDragStart={(e) => handleDragStart(e, i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={[
                "group flex items-center gap-2 px-2 py-2 rounded-lg border text-xs",
                "transition-all select-none",
                isDragging
                  ? "opacity-40 bg-indigo-50 border-indigo-300"
                  : isActive
                  ? "border-[#00AFCC] bg-[#E6F8FC]"
                  : "bg-white border-gray-100",
                isOver ? "border-indigo-400 bg-indigo-50 translate-y-0.5" : "",
              ].join(" ")}
            >
              {/* Drag handle */}
              <span className="text-gray-300 text-base leading-none cursor-grab active:cursor-grabbing shrink-0">
                ⠿
              </span>

              {/* セクション名（クリックでプレビュースクロール） */}
              <button
                type="button"
                onClick={() => {
                  if (draggingIndex !== null) return;
                  onSectionClick?.(sec.id);
                }}
                className={[
                  "flex-1 text-left font-medium truncate transition-colors min-w-0",
                  isActive ? "text-[#00AFCC]" : "text-gray-700 hover:text-[#00AFCC]",
                  onSectionClick ? "cursor-pointer" : "cursor-default",
                ].join(" ")}
                title={onSectionClick ? `「${sec.label}」へスクロール` : sec.label}
              >
                {isActive && (
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#00AFCC] mr-1.5 mb-0.5 shrink-0" />
                )}
                {sec.label}
              </button>

              {/* FAQ 項目追加ボタン（FAQ セクションのみ表示） */}
              {onAddFaqItem && sec.id.startsWith("faqblock") && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddFaqItem(sec.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all
                    text-gray-300 hover:text-[#00AFCC] hover:bg-[#E6F8FC] shrink-0 font-bold text-sm leading-none"
                  title="FAQ項目を追加"
                >
                  ＋
                </button>
              )}

              {/* 削除ボタン（hover 時のみ表示・保護セクションは非表示） */}
              {canDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSectionDelete(sec.id, sec.label);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded transition-all
                    text-gray-300 hover:text-red-500 hover:bg-red-50 shrink-0"
                  title={`「${sec.label}」を削除`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              )}

              {/* 並び替え矢印 */}
              <div className="flex gap-0.5 shrink-0">
                <button
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 text-gray-500"
                  title="上へ"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, i + 1)}
                  disabled={i === sections.length - 1}
                  className="p-0.5 rounded hover:bg-gray-100 disabled:opacity-20 text-gray-500"
                  title="下へ"
                >
                  ▼
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
