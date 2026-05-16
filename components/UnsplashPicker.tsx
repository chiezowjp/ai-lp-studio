"use client";

import { UnsplashResult, UnsplashPhoto, UploadedImage, ImagePlacement } from "@/types";

// Unsplash カテゴリ → ImagePlacement のマッピング
const CATEGORY_TO_PLACEMENT: Record<"hero" | "service" | "background", ImagePlacement> = {
  hero: "hero",
  service: "service",
  background: "other",
};

interface Props {
  result: UnsplashResult;
  selectedImages: UploadedImage[];
  onSelect: (image: UploadedImage) => void;
  onDeselect: (placement: ImagePlacement) => void;
}

export default function UnsplashPicker({ result, selectedImages, onSelect, onDeselect }: Props) {
  const getSelected = (placement: ImagePlacement) =>
    selectedImages.find((img) => img.placement === placement && img.attribution);

  const handleSelect = (photo: UnsplashPhoto, categoryId: "hero" | "service" | "background") => {
    const placement = CATEGORY_TO_PLACEMENT[categoryId];
    const alreadySelected = getSelected(placement);
    if (alreadySelected?.id === photo.id) {
      onDeselect(placement);
      return;
    }
    onSelect({
      id: photo.id,
      url: photo.urls.regular,
      name: photo.alt_description || `Unsplash photo by ${photo.user.name}`,
      placement,
      attribution: {
        photographerName: photo.user.name,
        photographerUrl: photo.user.links.html + "?utm_source=lp_generator&utm_medium=referral",
        photoUrl: photo.links.html + "?utm_source=lp_generator&utm_medium=referral",
      },
    });
  };

  // API キーなし：キーワードと検索リンクのみ表示
  if (!result.hasApiKey) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
          <strong>UNSPLASH_ACCESS_KEY が未設定です。</strong>
          <br />
          以下の検索リンクからUnsplashで画像を探し、URLをコピーしてご利用ください。
          <br />
          APIキーは{" "}
          <a href="https://unsplash.com/developers" target="_blank" rel="noopener noreferrer" className="underline">
            unsplash.com/developers
          </a>{" "}
          から無料取得できます。
        </div>

        <div className="space-y-2">
          {(
            [
              { id: "hero", label: "ファーストビュー", keyword: result.keywords.hero, link: result.searchLinks.hero },
              { id: "service", label: "サービス紹介", keyword: result.keywords.service, link: result.searchLinks.service },
              { id: "background", label: "背景", keyword: result.keywords.background, link: result.searchLinks.background },
            ] as const
          ).map((cat) => (
            <div key={cat.id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2.5 text-sm">
              <div>
                <span className="font-semibold text-gray-700">{cat.label}</span>
                <span className="ml-2 text-gray-400 text-xs">検索ワード: {cat.keyword}</span>
              </div>
              <a
                href={cat.link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline"
              >
                Unsplashで検索 →
              </a>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // API キーあり：サムネイル一覧表示
  return (
    <div className="space-y-5">
      {result.categories.map((cat) => {
        const placement = CATEGORY_TO_PLACEMENT[cat.id];
        const selectedInCategory = getSelected(placement);

        return (
          <div key={cat.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">{cat.label}</span>
                <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                  {cat.keyword}
                </span>
              </div>
              <a
                href={result.searchLinks[cat.id]}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-indigo-500 hover:text-indigo-700"
              >
                もっと見る →
              </a>
            </div>

            {cat.photos.length === 0 ? (
              <p className="text-xs text-gray-400 py-2">画像が見つかりませんでした</p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {cat.photos.map((photo) => {
                  const isSelected = selectedInCategory?.id === photo.id;
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => handleSelect(photo, cat.id)}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all ${
                        isSelected
                          ? "border-indigo-500 ring-2 ring-indigo-300"
                          : "border-transparent hover:border-indigo-300"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.urls.small}
                        alt={photo.alt_description || cat.keyword}
                        className="w-full h-20 object-cover"
                      />
                      {/* 選択済みバッジ */}
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-600/20 flex items-center justify-center">
                          <span className="bg-indigo-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            選択中
                          </span>
                        </div>
                      )}
                      {/* ホバー時フォトグラファー名 */}
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity truncate">
                        {photo.user.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* 選択画像の帰属表記 */}
            {selectedInCategory?.attribution && (
              <div className="text-[11px] text-gray-500 bg-gray-50 rounded px-2 py-1.5">
                📷 Photo by{" "}
                <a
                  href={selectedInCategory.attribution.photographerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  {selectedInCategory.attribution.photographerName}
                </a>{" "}
                on{" "}
                <a
                  href="https://unsplash.com?utm_source=lp_generator&utm_medium=referral"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  Unsplash
                </a>
              </div>
            )}
          </div>
        );
      })}

      {/* 全体帰属表記ガイド */}
      <div className="text-[11px] text-gray-400 border-t border-gray-100 pt-3">
        Unsplash の利用規約に従い、公開するLPには帰属表記（Photo by [Name] on Unsplash）を掲載することを推奨します。
      </div>
    </div>
  );
}
