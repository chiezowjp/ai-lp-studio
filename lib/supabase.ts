import { createClient } from "@supabase/supabase-js";

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "https://placeholder.supabase.co";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder";

/**
 * ブラウザで使うシングルトン Supabase クライアント。
 * 環境変数が未設定の場合はプレースホルダーで初期化するため、
 * ビルド時に環境変数が存在しなくてもエラーにならない。
 * 実際の認証・API 呼び出しは実行時に失敗する（意図した動作）。
 */
export const supabase = createClient(url, anon);

/** Supabase の DB projects 行の型 */
export interface DbProject {
  id: string;
  user_id: string;
  title: string;
  html: string;
  css: string;
  project_json: Record<string, unknown>;
  thumbnail: string | null;
  created_at: string;
  updated_at: string;
  // Phase 5 — 公開機能
  slug: string | null;
  is_published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  favicon_url: string | null;
  custom_css: string | null;
  custom_head_html: string | null;
  noindex: boolean;
  // Phase 6 — フォーム・リード取得
  form_config: Record<string, unknown> | null;
  // Phase 8 — Draft / Published 分離
  published_html: string | null;
  published_css: string | null;
  last_published_at: string | null;
}

/** leads テーブルの行型 */
export interface DbLead {
  id: string;
  project_id: string;
  project_slug: string | null;
  user_id: string;
  form_name: string;
  payload: Record<string, unknown>;
  submitted_at: string;
  ip_address: string | null;
  user_agent: string | null;
  referrer: string | null;
  status: "new" | "contacted" | "archived";
}

// ── Phase 8 ──────────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | "page_view"
  | "scroll_depth"
  | "cta_click"
  | "form_open"
  | "form_submit"
  | "button_click"
  | "outbound_click";

export interface DbAnalyticsEvent {
  id: string;
  project_id: string;
  visitor_id: string;
  session_id: string;
  event_type: AnalyticsEventType;
  metadata: Record<string, unknown>;
  created_at: string;
  user_agent: string | null;
  referrer: string | null;
  country: string | null;
  device_type: "desktop" | "mobile" | "tablet" | null;
}

export interface DbVersion {
  id: string;
  project_id: string;
  user_id: string;
  snapshot_json: {
    html: string;
    css: string;
    project_json?: Record<string, unknown>;
    title?: string;
  };
  trigger: "publish" | "rollback" | "manual" | "ai_improve" | "auto";
  note: string | null;
  created_at: string;
}

export interface DbAsset {
  id: string;
  user_id: string;
  project_id: string | null;
  url: string;
  storage_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  width: number | null;
  height: number | null;
  usage_type: "general" | "og_image" | "favicon" | "lp_image" | null;
  created_at: string;
}

/** Analytics ダッシュボード集計データ */
export interface AnalyticsSummary {
  totalPageViews: number;
  uniqueVisitors: number;
  ctaClickRate: number;
  formOpenRate: number;
  formSubmitRate: number;
  scrollDepths: { depth: number; count: number }[];
  deviceBreakdown: { device: string; count: number }[];
  dailySeries: { date: string; pageViews: number; ctaClicks: number; formSubmits: number }[];
  topReferrers: { referrer: string; count: number }[];
}
