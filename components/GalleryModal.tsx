"use client";

import { useState } from "react";
import { GALLERY, GalleryImage } from "@/lib/gallery";

interface Props {
  open: boolean;
  onClose: () => void;
  /** 画像を選択したときのコールバック */
  onSelect: (image: GalleryImage) => void;
}

export default function GalleryModal({ open, onClose, onSelect }: Props) {
  const [activeCategoryId, setActiveCategoryId] = useState(GALLERY[0]?.id ?? "");

  if (!open) return null;

  const activeCategory = GALLERY.find((c) => c.id === activeCategoryId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "80vh" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-sm font-bold text-gray-900">テンプレ画像ギャラリー</h2>
            <p className="text-[11px] text-gray-400 mt-0.5">業種別の素材を選んでLPに挿入</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex overflow-x-auto border-b border-gray-100 shrink-0 px-2">
          {GALLERY.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryId(cat.id)}
              className={[
                "flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0",
                activeCategoryId === cat.id
                  ? "text-[#00AFCC] border-[#00AFCC] bg-[#E6F8FC]"
                  : "text-gray-500 border-transparent hover:text-gray-700 hover:bg-gray-50",
              ].join(" ")}
            >
              <span>{cat.icon}</span>
              {cat.label}
              {cat.images.length > 0 && (
                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                  {cat.images.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Image grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {!activeCategory || activeCategory.images.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">{activeCategory?.icon ?? "🖼"}</div>
              <p className="text-sm font-semibold text-gray-500">画像がまだありません</p>
              <p className="text-xs text-gray-400 mt-1">
                public/gallery/{activeCategoryId}/ に画像を追加して<br />
                lib/gallery.ts に登録してください
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {activeCategory.images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => { onSelect(img); onClose(); }}
                  className="group relative aspect-video rounded-xl overflow-hidden border-2 border-transparent hover:border-[#00AFCC] transition-all shadow-sm"
                >
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-[10px] font-medium truncate">{img.alt}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-3 bg-gray-50 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">
            画像をクリックすると選択中の要素に挿入されます
          </p>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
