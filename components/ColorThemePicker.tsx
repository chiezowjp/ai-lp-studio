"use client";

interface Props {
  /** CSSから抽出した元の色 → 現在の色 のペア */
  swatches: { original: string; current: string }[];
  onReplace: (original: string, newColor: string) => void;
  onReset: () => void;
  /** カラーピッカーを開く直前に呼ばれる（アンドゥ用スナップショット取得） */
  onPickStart?: () => void;
}

const SWATCH_LABELS = [
  "カラー 1", "カラー 2", "カラー 3",
  "カラー 4", "カラー 5", "カラー 6",
  "カラー 7", "カラー 8",
];

export default function ColorThemePicker({ swatches, onReplace, onReset, onPickStart }: Props) {
  if (swatches.length === 0) {
    return <p className="text-xs text-gray-400">CSSからカラーを抽出中…</p>;
  }

  const hasChanges = swatches.some((s) => s.original !== s.current);

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-400 leading-relaxed">
        生成CSSの主要カラーを変更できます。クリックして色を選択してください。
      </p>

      <div className="space-y-2">
        {swatches.map((swatch, i) => (
          <div key={swatch.original} className="flex items-center gap-2">
            <label className="text-xs text-gray-600 w-16 shrink-0">
              {SWATCH_LABELS[i] ?? `カラー ${i + 1}`}
            </label>
            <div className="relative">
              <input
                type="color"
                value={swatch.current}
                onMouseDown={() => onPickStart?.()}
                onChange={(e) => onReplace(swatch.original, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-gray-200 p-0.5 bg-white"
                title={`${swatch.current} (元: ${swatch.original})`}
              />
              {swatch.original !== swatch.current && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-indigo-500 rounded-full border border-white" />
              )}
            </div>
            <span className="text-[10px] text-gray-400 font-mono truncate max-w-[80px]">
              {swatch.current}
            </span>
            {swatch.original !== swatch.current && (
              <button
                onClick={() => onReplace(swatch.original, swatch.original)}
                className="text-[10px] text-gray-400 hover:text-red-500 ml-auto shrink-0"
                title="元に戻す"
              >
                ✕
              </button>
            )}
          </div>
        ))}
      </div>

      {hasChanges && (
        <button
          onClick={onReset}
          className="w-full text-xs text-gray-500 hover:text-red-600 border border-gray-200 hover:border-red-300 rounded-lg py-1.5 transition-colors"
        >
          すべてリセット
        </button>
      )}
    </div>
  );
}
