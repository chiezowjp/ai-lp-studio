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

export default function SectionSorter({
  sections,
  onChange,
  onSectionClick,
  activeSectionId,
  onSectionDelete,
  protectedIds,
}: Props) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  if (sections.length === 0) {
    return <p className="text-xs text-gray-400">セクションを検出中…</p>;
  }

  const handleDragStart = (i: number) => setDragIndex(i);

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setOverIndex(i);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...sections];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(dropIndex, 0, moved);
    onChange(next.map((s) => s.id));
    setDragIndex(null);
    setOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setOverIndex(null);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= sections.length) return;
    const next = [...sections];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next.map((s) => s.id));
  };

  return (
    <div className="space-y-1">
      <p className="text-[11px] text-gray-400 mb-2">
        名前クリックでプレビューへ移動・ドラッグまたは矢印で並び替え
      </p>
      <ul ref={listRef} className="space-y-1">
        {sections.map((sec, i) => {
          const isDragging = dragIndex === i;
          const isOver = overIndex === i && dragIndex !== i;
          const isActive = sec.id === activeSectionId;
          const isProtected = protectedIds?.has(sec.id) ?? false;
          const canDelete = !!onSectionDelete && !isProtected;

          return (
            <li
              key={sec.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`
                group flex items-center gap-2 px-2 py-2 rounded-lg border text-xs
                transition-all select-none
                ${isDragging ? "opacity-40 bg-indigo-50 border-indigo-300" : ""}
                ${isActive && !isDragging ? "border-[#00AFCC] bg-[#E6F8FC]" : !isDragging ? "bg-white border-gray-100" : ""}
                ${isOver ? "border-indigo-400 bg-indigo-50 translate-y-0.5" : ""}
              `}
            >
              {/* Drag handle */}
              <span className="text-gray-300 text-base leading-none cursor-grab active:cursor-grabbing shrink-0">
                ⠿
              </span>

              {/* セクション名（クリックでプレビュースクロール） */}
              <button
                type="button"
                onClick={() => {
                  if (dragIndex !== null) return;
                  onSectionClick?.(sec.id);
                }}
                className={`flex-1 text-left font-medium truncate transition-colors min-w-0 ${
                  isActive
                    ? "text-[#00AFCC]"
                    : "text-gray-700 hover:text-[#00AFCC]"
                } ${onSectionClick ? "cursor-pointer" : "cursor-default"}`}
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
                  {/* ゴミ箱アイコン（SVG） */}
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
