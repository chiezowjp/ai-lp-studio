/**
 * lib/tracking.ts
 * アクセス解析・広告タグのスクリプト文字列を生成するヘルパー。
 * 公開LPページ（Server Component）から呼び出され、HeadInjector に渡す。
 */

export interface TrackingConfig {
  metaPixelId?: string | null;
  ga4Id?: string | null;
  gtmId?: string | null;
  customHeadHtml?: string | null;
}

/**
 * 各IDからHeadに挿入するHTMLを生成して返す。
 * isPreview=true のとき、自動生成タグ（Pixel/GA4/GTM）はスキップ。
 * カスタムHeadコードは常に含める（テスト目的での利用を想定）。
 */
export function buildTrackingHeadHtml(config: TrackingConfig, isPreview = false): string {
  const parts: string[] = [];

  if (!isPreview) {
    // ── Meta Pixel ─────────────────────────────────────────────────────────
    if (config.metaPixelId?.trim()) {
      const pid = config.metaPixelId.trim();
      parts.push(`<!-- Meta Pixel Code -->
<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pid}');fbq('track','PageView');</script>
<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${pid}&ev=PageView&noscript=1"/></noscript>
<!-- End Meta Pixel Code -->`);
    }

    // ── Google Analytics 4 ─────────────────────────────────────────────────
    if (config.ga4Id?.trim()) {
      const gid = config.ga4Id.trim();
      parts.push(`<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${gid}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${gid}');</script>`);
    }

    // ── Google Tag Manager ─────────────────────────────────────────────────
    if (config.gtmId?.trim()) {
      const tid = config.gtmId.trim();
      parts.push(`<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${tid}');</script>
<!-- End Google Tag Manager -->`);
    }
  }

  // カスタムHeadコードは isPreview に関わらず常に注入
  if (config.customHeadHtml?.trim()) {
    parts.push(config.customHeadHtml.trim());
  }

  return parts.join("\n");
}
