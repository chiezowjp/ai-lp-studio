/**
 * テンプレート画像ギャラリーの設定ファイル
 *
 * 画像を追加する手順：
 *   1. public/gallery/{カテゴリID}/ フォルダに画像ファイルを置く
 *   2. 下の GALLERY 配列に対応するエントリを追加する
 *
 * 例：
 *   public/gallery/beauty/hero1.jpg を追加したい場合
 *   → beauty カテゴリの images に { src: "/gallery/beauty/hero1.jpg", alt: "サロン外観" } を追加
 */

export interface GalleryImage {
  /** /gallery/... から始まるパス */
  src: string;
  /** 画像の説明（alt テキスト兼ラベル） */
  alt: string;
}

export interface GalleryCategory {
  id: string;
  /** 表示名 */
  label: string;
  /** 絵文字アイコン */
  icon: string;
  images: GalleryImage[];
}

export const GALLERY: GalleryCategory[] = [
  {
    id: "beauty",
    label: "美容・サロン",
    icon: "💄",
    images: [
      { src: "/gallery/beauty/beauty1.png", alt: "美容サロン素材1" },
      { src: "/gallery/beauty/beauty2.png", alt: "美容サロン素材2" },
      { src: "/gallery/beauty/beauty3.png", alt: "美容サロン素材3" },
      { src: "/gallery/beauty/beauty4.png", alt: "美容サロン素材4" },
      { src: "/gallery/beauty/tasukare2.png", alt: "美容サロン素材5" },
    ],
  },
  {
    id: "health",
    label: "健康・医療",
    icon: "🏥",
    images: [
      // 例: { src: "/gallery/health/clinic1.jpg", alt: "クリニック外観" },
    ],
  },
  {
    id: "business",
    label: "ビジネス・士業",
    icon: "💼",
    images: [
      // 例: { src: "/gallery/business/office1.jpg", alt: "オフィス" },
    ],
  },
  {
    id: "food",
    label: "飲食・カフェ",
    icon: "🍽",
    images: [
      // 例: { src: "/gallery/food/restaurant1.jpg", alt: "店内" },
    ],
  },
  {
    id: "education",
    label: "教育・スクール",
    icon: "📚",
    images: [
      // 例: { src: "/gallery/education/class1.jpg", alt: "授業風景" },
    ],
  },
  {
    id: "common",
    label: "共通素材",
    icon: "🖼",
    images: [
      // 例: { src: "/gallery/common/hero_bg1.jpg", alt: "背景素材1" },
    ],
  },
];
