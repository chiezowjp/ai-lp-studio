export type CTAType = "line" | "phone" | "contact";
export type ImagePlacement = "hero" | "service" | "testimonial" | "other";
export type PreviewMode = "desktop" | "mobile";

export interface LPFormData {
  industry: string;
  target: string;
  area: string;
  serviceName: string;
  serviceDetail: string;
  price: string;
  strengths: string;
  designMood: string;
  ctaType: CTAType;
  ctaLink: string;
}

export interface GeneratedLP {
  html: string;
  css: string;
}

export interface UploadedImage {
  id: string;
  url: string;
  name: string;
  placement: ImagePlacement;
  /** Unsplash 画像の場合のみ設定 */
  attribution?: {
    photographerName: string;
    photographerUrl: string;
    photoUrl: string;
  };
}

export interface SEOItem {
  label: string;
  status: "ok" | "warn" | "error";
  value: string;
  suggestion?: string;
}

export interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string | null;
  user: { name: string; links: { html: string } };
  links: { html: string };
}

export interface UnsplashCategory {
  id: "hero" | "service" | "background";
  label: string;
  keyword: string;
  photos: UnsplashPhoto[];
}

export interface UnsplashResult {
  hasApiKey: boolean;
  keywords: { hero: string; service: string; background: string };
  searchLinks: { hero: string; service: string; background: string };
  categories: UnsplashCategory[];
}

// ── Image Prompt Assistant ────────────────────────────────────────────────────

export type ImageAITool =
  | "chatgpt" | "midjourney" | "canva"
  | "gemini" | "leonardo" | "stablediffusion" | "other";

export type ImagePlacementLP =
  | "hero" | "service" | "cta" | "testimonial"
  | "background" | "gallery" | "beforeafter" | "other";

export type ImageMood =
  | "luxury" | "natural" | "soft" | "simple"
  | "dark" | "light" | "feminine" | "masculine"
  | "hotel" | "korean" | "nordic" | "modern" | "japanese";

export type ImageSizeType = "landscape" | "portrait" | "square" | "mobile";
export type ImageBrightnessType = "bright" | "dark" | "natural" | "studio";

export interface ImagePromptConfig {
  aiTool: ImageAITool;
  placement: ImagePlacementLP;
  moods: ImageMood[];
  hasPeople: boolean;
  peopleAge?: string;
  peopleNationality?: "japanese" | "foreign" | "both";
  peopleGender?: "female" | "male" | "mixed";
  backgroundDescription?: string;
  colorPreference?: string;
  size: ImageSizeType;
  needsTextSpace: boolean;
  brightness: ImageBrightnessType;
}

export interface ImagePromptResult {
  japanese: string;
  english: string;
  optimized: string;
  tips: string[];
}

// ── Site Importer ─────────────────────────────────────────────────────────────

export interface ExtractedSiteData {
  serviceName: string;
  industry: string;
  target: string;
  area: string;
  serviceDetail: string;
  price: string;
  strengths: string;
  designMood: string;
  ctaType: string;
  ctaLink: string;
  // 追加情報（表示用・LPFormData 外）
  address: string;
  phone: string;
  businessHours: string;
  seoKeywords: string;
  frequentWords: string;
  imageStyle: string;
}

// ── Image Tone Analysis ───────────────────────────────────────────────────────

export interface ImageToneAnalysis {
  url: string;
  placement: string;       // 使用場所の推定
  composition: string;     // 構図
  colorTone: string;       // 色味
  brightness: string;      // 明るさ
  hasPeople: boolean;      // 人物の有無
  ageGroup: string;        // 年齢層
  whiteSpace: string;      // 余白の取り方
  mood: string;            // 印象・雰囲気
  textFriendly: boolean;   // テキストを載せやすいか
  promptJa: string;        // 日本語プロンプト
  promptEn: string;        // 英語プロンプト
  promptMidjourney: string;
  promptChatGPT: string;
  promptCanva: string;
}

// ── Reference LP Analysis ─────────────────────────────────────────────────────

export interface AnalyzedSection {
  id: string;        // スネークケースID（例：hero, comparison, guarantee）
  name: string;      // 日本語セクション名
  role: string;      // 役割の説明（1文）
  included: boolean; // 採用するか（ユーザーが変更可）
  order: number;     // 順番
}

export interface LPAnalysis {
  sections: AnalyzedSection[];
  colorTone: string;          // 色味の傾向
  designMood: string;         // デザイン雰囲気
  headlineTone: string;       // 見出しのトーン
  appealFlow: string;         // 訴求の流れ
  ctaStrength: string;        // CTAの強さ
  trustElements: string[];    // 信頼要素
  keywords: string[];         // よく使われるキーワード
  hasFaq: boolean;
  hasTestimonials: boolean;
  hasPricing: boolean;
  conversionStrategy: string; // 学ぶべき訴求ポイント
  notes: string;              // 注意点
}

// ── Visual Style Editor ───────────────────────────────────────────────────────

export interface SelectedElement {
  type: "heading" | "text" | "button" | "section" | "image";
  selector: string;
  tagName: string;
  label: string;
  computedStyles: Record<string, string>;
}

export interface StyleRule {
  styles: Record<string, string>;
  hoverStyles?: Record<string, string>;
  animation?: "none" | "lift" | "scale" | "pulse";
  mobileFullWidth?: boolean;
}

export type VisualStyles = Record<string, StyleRule>;

export interface SavedImagePrompt {
  id: string;
  sectionLabel: string;
  aiTool: ImageAITool;
  config: ImagePromptConfig;
  result: ImagePromptResult;
  createdAt: string;
}
