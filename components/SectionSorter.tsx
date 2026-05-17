"use client";

import { useRef, useState } from "react";

export interface SortableSection {
  id: string;
  label: string;
}

interface Props {
  sections: SortableSection[];
  onChange: (newOrder: string[]) => void;
  /** セクション名クリック時のコールバック（プレビュースクロール用） */
  onSectionClick?: (id: string) => void;
  /** 現在アクティブ（スクロール先）のセクション ID */
  activeSectionId?: string | null;
  /** 削除リクエストのコールバック */
  onSectionDelete?: (id: string, label: string) => void;
  /** 削除不可のセクション ID セット */
  protectedIds?: Set<string>;
}

/** ドラッグ data-transfer key */
const DT_KEY = "application/x-section-index";

export default function SectionSorter({
  sections,
  onChange,
  onSectionClick,
  activeSectionId,
  onSectionDelete,
  protectedIds,
}: Props) {
  // 視覚フィードバック用 state（ドラッグ中のインデックスは dataTransfer で管理）
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  /**
   * sections を常に最新版で参照するための ref。
   * ドラッグ操作中に re-render が起きても applyReorder が古い配列を参照しない。
   */
  const sectionsRef = useRef<SortableSection[]>(sections);
  sectionsRef.current = sections;

  if (sections.length === 0) {
    return <p className="text-xs text-gray-400">セクションを検出中…</p>;
  }

  // ────────────────────────────────────────────────────────────────────────
  // 共通並び替え関数：ドラッグ完了時・▲▼ボタン、どちらもここを呼ぶ
  // ────────────────────────────────────────────────────────────────────────
  const applyReorder = (fromIndex: number, toIndex: number) => {
    const current = sectionsRef.current; // 常に最新
    if (
      fromIndex === toIndex ||
      fromIndex < 0 || toIndex < 0 ||
      fromIndex >= current.length || toIndex >= current.length
    ) return;
    const next = [...current];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    onChange(next.map((s) => s.id)); // → page.tsx の handleSectionReorder を呼ぶ
  };

  // ── Drag handlers ────────────────────────────────────────────────────────

  const handleDragStart = (e: React.DragEvent, i: number) => {
    // インデックスをネイティブ API で保持（React state とは独立、re-render に影響されない）
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(DT_KEY, String(i));

    // 視覚フィードバック（opacity など）は requestAnimationFrame で遅延。
    // ブラウザがドラッグ画像をキャプチャした AFTER に DOM を変更することで
    // ドラッグ操作のキャンセルを防ぐ。
    requestAnimationFrame(() => setDraggingIndex(i));
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overIndex !== i) setOverIndex(i);
  };

  const handleDrop = (e: React.DragEvent, toIndex: number) => {
    e.preventDefault();
    // dataTransfer からドラッグ元インデックスを取得（React state に依存しない）
    const fromStr = e.dataTransfer.getData(DT_KEY);
    const fromIndex = parseInt(fromStr, 10);

    if (!isNaN(fromIndex)) {
      applyReorder(fromIndex, toIndex); // → HTML も sectionOrder も更新される
    }

    setDraggingIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    // drop が発火しなかった場合（ドラッグキャンセル等）のクリーンアップ
    setDraggingIndex(null);
    setOverIndex(null);
  };

  // ── ▲▼ ボタン ────────────────────────────────────────────────────────────

  const move = (from: number, to: number) => {
    applyReorder(from, to); // 共通関数を使用
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
