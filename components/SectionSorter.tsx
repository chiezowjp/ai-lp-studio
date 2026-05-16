"use client";

import { useRef, useState } from "react";

export interface SortableSection {
  id: string;
  label: string;
}

interface Props {
  sections: SortableSection[];
  onChange: (newOrder: string[]) => void;
}

export default function SectionSorter({ sections, onChange }: Props) {
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
      <p className="text-[11px] text-gray-400 mb-2">ドラッグまたは矢印でセクションを並び替えます</p>
      <ul ref={listRef} className="space-y-1">
        {sections.map((sec, i) => {
          const isDragging = dragIndex === i;
          const isOver = overIndex === i && dragIndex !== i;
          return (
            <li
              key={sec.id}
              draggable
              onDragStart={() => handleDragStart(i)}
              onDragOver={(e) => handleDragOver(e, i)}
              onDrop={(e) => handleDrop(e, i)}
              onDragEnd={handleDragEnd}
              className={`
                flex items-center gap-2 px-2 py-2 rounded-lg border text-xs
                transition-all cursor-grab active:cursor-grabbing select-none
                ${isDragging ? "opacity-40 bg-indigo-50 border-indigo-300" : "bg-white border-gray-100"}
                ${isOver ? "border-indigo-400 bg-indigo-50 translate-y-0.5" : ""}
              `}
            >
              {/* Drag handle */}
              <span className="text-gray-300 text-base leading-none">⠿</span>
              <span className="flex-1 font-medium text-gray-700">{sec.label}</span>
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
