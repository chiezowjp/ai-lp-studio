"use client";

import { useRef } from "react";
import { UploadedImage, ImagePlacement } from "@/types";

const PLACEMENT_LABELS: Record<ImagePlacement, string> = {
  hero: "ヒーロー（メイン背景）",
  service: "サービス紹介",
  testimonial: "お客様の声",
  other: "その他",
};

interface Props {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}

export default function ImageUploader({ images, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const added: UploadedImage[] = Array.from(files).map((file) => ({
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url: URL.createObjectURL(file),
      name: file.name,
      placement: "hero",
    }));
    onChange([...images, ...added]);
  };

  const updatePlacement = (id: string, placement: ImagePlacement) => {
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
        onChange={(e) => handleFiles(e.target.files)}
      />

      {images.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl p-5 text-sm text-gray-400 hover:border-indigo-300 hover:text-indigo-400 transition-colors text-center"
        >
          クリックして画像を選択（複数可）
          <br />
          <span className="text-xs">プレビューのヒーロー・各セクション背景に反映します</span>
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
                onChange={(e) => updatePlacement(img.id, e.target.value as ImagePlacement)}
                className="w-full text-xs border border-gray-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-300 bg-white"
              >
                {(Object.entries(PLACEMENT_LABELS) as [ImagePlacement, string][]).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {images.length > 0 && (
        <p className="text-xs text-gray-400">
          選択した配置先のセクション背景にプレビュー反映されます
        </p>
      )}
    </div>
  );
}
