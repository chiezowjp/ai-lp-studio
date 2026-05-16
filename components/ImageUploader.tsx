"use client";

import { useRef } from "react";
import { UploadedImage } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** LP 生成前（sectionOrder 未確定）に使うフォールバック選択肢 */
const DEFAULT_SECTIONS: { id: string; label: string }[] = [
  { id: "hero",        label: "ヒーロー（メイン背景）" },
  { id: "service",     label: "サービス紹介" },
  { id: "testimonial", label: "お客様の声" },
  { id: "other",       label: "その他（汎用背景）" },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  /**
   * 生成済みLPのセクション一覧。
   * 渡された場合はこれを選択肢として使用する（末尾に「その他」を自動追加）。
   * 未渡しの場合は DEFAULT_SECTIONS にフォールバック。
   */
  availableSections?: { id: string; label: string }[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageUploader({ images, onChange, availableSections }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  /** 実際に select に並べる選択肢 */
  const sections: { id: string; label: string }[] = availableSections && availableSections.length > 0
    ? [
        ...availableSections,
        // 「その他」がまだ含まれていなければ末尾に追加
        ...(availableSections.some((s) => s.id === "other")
          ? []
          : [{ id: "other", label: "その他（汎用背景）" }]),
      ]
    : DEFAULT_SECTIONS;

  /** 新規アップロード時のデフォルト配置先 */
  const defaultPlacement = sections[0]?.id ?? "hero";

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const added: UploadedImage[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      placement: defaultPlacement,
    }));
    onChange([...images, ...added]);
  };

  const updatePlacement = (id: string, placement: string) => {
    onChange(images.map((img) => (img.id === id ? { ...img, placement } : img)));
  };

  const remove = (id: string) => {
    const img = images.find((i) => i.id === id);
    if (img) URL.revokeObjectURL(img.url);
    onChange(images.filter((i) => i.id !== id));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">画像アップロード</h3>
        {images.length > 0 && (
          <button
            onClick={() => inputRef.current?.click()}
            className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
          >
            + 追加
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl p-5 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors text-center"
        >
          クリックして画像を選択（複数可）
          <br />
          <span className="text-xs">選択したセクションの背景に反映します</span>
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {images.map((img) => (
            <div key={img.id} className="border border-gray-200 rounded-lg p-2 space-y-1.5 bg-gray-50">
              <div className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.name} className="w-full h-20 object-cover rounded" />
                <button
                  type="button"
                  onClick={() => remove(img.id)}
                  className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full leading-none hover:bg-red-600 flex items-center justify-center"
                >
                  ×
                </button>
              </div>
              <p className="text-xs text-gray-500 truncate">{img.name}</p>
              <select
                value={img.placement}
                onChange={(e) => updatePlacement(img.id, e.target.value)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
              >
                {sections.map(({ id, label }) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-gray-400">
          選択したセクションの背景画像として反映されます
        </p>
      )}
    </div>
  );
}
