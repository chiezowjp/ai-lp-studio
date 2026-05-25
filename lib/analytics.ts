/**
 * lib/analytics.ts — Analytics ユーティリティ（サーバーサイド）
 *
 * - Bot 除外（User-Agent ベース）
 * - デバイス種別判定
 * - Analytics イベントの一括集計ヘルパー
 */

// ─── Bot 除外 ─────────────────────────────────────────────────────────────────

const BOT_PATTERNS = [
  /bot/i, /crawler/i, /spider/i, /slurp/i, /facebookexternalhit/i,
  /twitterbot/i, /linkedinbot/i, /googlebot/i, /bingbot/i, /yandex/i,
  /duckduckbot/i, /baiduspider/i, /sogou/i, /exabot/i, /facebot/i,
  /ia_archiver/i, /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i,
  /rogerbot/i, /screaming.frog/i, /curl/i, /python-requests/i, /axios/i,
  /java\//i, /go-http-client/i, /okhttp/i, /php/i,
];

export function isBot(userAgent: string | null): boolean {
  if (!userAgent) return false;
  return BOT_PATTERNS.some((pat) => pat.test(userAgent));
}

// ─── デバイス種別判定 ─────────────────────────────────────────────────────────

export function detectDevice(
  userAgent: string | null,
): "desktop" | "mobile" | "tablet" | null {
  if (!userAgent) return null;
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobile|iphone|ipod|android|blackberry|windows phone/.test(ua))
    return "mobile";
  return "desktop";
}

// ─── 有効なイベント種別 ───────────────────────────────────────────────────────

export const VALID_EVENT_TYPES = new Set([
  "page_view",
  "scroll_depth",
  "cta_click",
  "form_open",
  "form_submit",
  "button_click",
  "outbound_click",
]);

// ─── 集計ヘルパー ─────────────────────────────────────────────────────────────

export interface RawAnalyticsRow {
  event_type: string;
  visitor_id: string;
  session_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
  device_type: string | null;
  referrer: string | null;
}

export function aggregateAnalytics(rows: RawAnalyticsRow[]) {
  const pageViews   = rows.filter((r) => r.event_type === "page_view");
  const ctaClicks   = rows.filter((r) => r.event_type === "cta_click");
  const formOpens   = rows.filter((r) => r.event_type === "form_open");
  const formSubmits = rows.filter((r) => r.event_type === "form_submit");
  const scrollRows  = rows.filter((r) => r.event_type === "scroll_depth");

  const uniqueVisitors = new Set(pageViews.map((r) => r.visitor_id)).size;
  const totalPageViews = pageViews.length;

  const ctaClickRate   = totalPageViews > 0 ? ctaClicks.length   / totalPageViews : 0;
  const formOpenRate   = totalPageViews > 0 ? formOpens.length   / totalPageViews : 0;
  const formSubmitRate = totalPageViews > 0 ? formSubmits.length / totalPageViews : 0;

  // スクロール深度別カウント
  const depthMap: Record<number, number> = { 25: 0, 50: 0, 75: 0, 100: 0 };
  for (const r of scrollRows) {
    const depth = Number(r.metadata?.depth ?? 0);
    if (depth in depthMap) depthMap[depth]++;
  }
  const scrollDepths = Object.entries(depthMap).map(([d, c]) => ({
    depth: Number(d),
    count: c,
  }));

  // デバイス比率
  const deviceMap: Record<string, number> = {};
  for (const r of rows) {
    const d = r.device_type ?? "unknown";
    deviceMap[d] = (deviceMap[d] ?? 0) + 1;
  }
  const deviceBreakdown = Object.entries(deviceMap).map(([device, count]) => ({
    device,
    count,
  }));

  // 日別シリーズ（直近30日）
  const dailyMap: Record<
    string,
    { pageViews: number; ctaClicks: number; formSubmits: number }
  > = {};
  for (const r of rows) {
    const date = r.created_at.slice(0, 10);
    if (!dailyMap[date])
      dailyMap[date] = { pageViews: 0, ctaClicks: 0, formSubmits: 0 };
    if (r.event_type === "page_view")   dailyMap[date].pageViews++;
    if (r.event_type === "cta_click")   dailyMap[date].ctaClicks++;
    if (r.event_type === "form_submit") dailyMap[date].formSubmits++;
  }
  const dailySeries = Object.entries(dailyMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, v]) => ({ date, ...v }));

  // 上位リファラー
  const refMap: Record<string, number> = {};
  for (const r of pageViews) {
    const ref = r.referrer ? new URL(r.referrer).hostname : "direct";
    refMap[ref] = (refMap[ref] ?? 0) + 1;
  }
  const topReferrers = Object.entries(refMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([referrer, count]) => ({ referrer, count }));

  return {
    totalPageViews,
    uniqueVisitors,
    ctaClickRate,
    formOpenRate,
    formSubmitRate,
    scrollDepths,
    deviceBreakdown,
    dailySeries,
    topReferrers,
  };
}
