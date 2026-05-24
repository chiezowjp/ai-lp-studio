// ── LP フォント定義 ───────────────────────────────────────────────────────────

export interface FontOption {
  id: string;
  label: string;
  /** CSS font-family 値（フォールバック込み） */
  cssFamily: string;
  /** Google Fonts の <link href> URL。システムフォントは undefined */
  googleFontsUrl?: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    id: "noto-sans-jp",
    label: "Noto Sans JP（デフォルト）",
    cssFamily: "'Noto Sans JP', 'Hiragino Kaku Gothic ProN', 'Hiragino Sans', Meiryo, sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap",
  },
  {
    id: "noto-serif-jp",
    label: "Noto Serif JP（明朝体）",
    cssFamily: "'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;500;700&display=swap",
  },
  {
    id: "zen-kaku-gothic",
    label: "Zen Kaku Gothic New（丸ゴシック）",
    cssFamily: "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', sans-serif",
    googleFontsUrl:
      "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@300;400;500;700&display=swap",
  },
  {
    id: "yu-gothic",
    label: "Yu Gothic（游ゴシック）",
    cssFamily: "'Yu Gothic', 'YuGothic', 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
    googleFontsUrl: undefined,
  },
  {
    id: "hiragino",
    label: "Hiragino Sans（ヒラギノ角ゴ）",
    cssFamily: "'Hiragino Kaku Gothic ProN', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif",
    googleFontsUrl: undefined,
  },
  {
    id: "system-ui",
    label: "System UI（システムフォント）",
    cssFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    googleFontsUrl: undefined,
  },
  {
    id: "serif",
    label: "Serif（明朝系）",
    cssFamily: "'Hiragino Mincho ProN', 'Yu Mincho', 'YuMincho', 'Times New Roman', serif",
    googleFontsUrl: undefined,
  },
  {
    id: "sans-serif",
    label: "Sans-serif（ゴシック系）",
    cssFamily: "'Hiragino Kaku Gothic ProN', Meiryo, Arial, sans-serif",
    googleFontsUrl: undefined,
  },
];

export const DEFAULT_FONT_ID = "noto-sans-jp";

/** フォントIDからFontOptionを取得（見つからなければデフォルト） */
export function getFontOption(id: string): FontOption {
  return FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0];
}

/** フォントIDからCSS文字列を生成（body全体に適用） */
export function buildFontCss(fontId: string): string {
  const font = getFontOption(fontId);
  return `/* グローバルフォント */\nbody, body * { font-family: ${font.cssFamily} !important; }`;
}

/** フォントIDからGoogle Fonts URLを返す（システムフォントはundefined） */
export function getFontGoogleUrl(fontId: string): string | undefined {
  return getFontOption(fontId).googleFontsUrl;
}
