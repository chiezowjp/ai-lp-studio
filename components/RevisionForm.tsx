"use client";

import { useState } from "react";

interface Props {
  onRevise: (instruction: string) => void;
  loading: boolean;
}

export default function RevisionForm({ onRevise, loading }: Props) {
  const [instruction, setInstruction] = useState("");

  const handleSubmit = () => {
    if (!instruction.trim() || loading) return;
    onRevise(instruction.trim());
    setInstruction("");
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-700">デザイン修正指示</h3>
      <textarea
        value={instruction}
        onChange={(e) => setInstruction(e.target.value)}
        disabled={loading}
        placeholder={"例：ヒーローのキャッチコピーをもっとインパクトのある文言に変更してください\n例：料金表のデザインをカード形式に変更し、おすすめプランを目立たせてください\n例：全体のカラーをネイビーと金色に統一してください"}
        rows={4}
        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none disabled:opacity-50 disabled:bg-gray-50"
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading || !instruction.trim()}
        className="w-full py-2.5 px-4 rounded-xl font-semibold text-sm text-white
          bg-gradient-to-r from-violet-600 to-indigo-600
          hover:from-violet-700 hover:to-indigo-700
          disabled:opacity-50 disabled:cursor-not-allowed transition-all"
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            AIが修正中… (30〜60秒)
          </span>
        ) : "AIで修正する"}
      </button>
    </div>
  );
}
