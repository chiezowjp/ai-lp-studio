"use client";

/**
 * components/AnalyticsTracker.tsx
 *
 * 公開 LP に埋め込む軽量トラッキングコンポーネント。
 * - page_view 送信
 * - scroll_depth 送信（25 / 50 / 75 / 100 %）
 * - CTA クリック計測（data-lp-cta 属性のある要素）
 * - 外部リンク計測
 * - Heatmap クリック送信
 *
 * SSR では何もしない（useEffect のみ）。
 * 全送信は navigator.sendBeacon → fetch フォールバックで非同期。
 */

import { useEffect } from "react";

interface Props {
  projectId: string;
}

// ─── localStorage / sessionStorage ヘルパー ────────────────────────────────────

function getOrCreate(storage: Storage, key: string): string {
  let val = storage.getItem(key);
  if (!val) {
    val = crypto.randomUUID();
    storage.setItem(key, val);
  }
  return val;
}

// ─── イベント送信（sendBeacon → fetch フォールバック） ────────────────────────

function sendEvent(
  projectId: string,
  visitorId: string,
  sessionId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
) {
  const payload = JSON.stringify({
    projectId,
    visitorId,
    sessionId,
    eventType,
    metadata,
    referrer: document.referrer || undefined,
  });

  const url = "/api/analytics/event";

  if (navigator.sendBeacon) {
    navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
  } else {
    fetch(url, { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

function sendHeatmap(
  projectId: string,
  visitorId: string,
  sessionId: string,
  eventType: string,
  extra: Record<string, unknown>,
) {
  const payload = JSON.stringify({ projectId, visitorId, sessionId, eventType, ...extra });
  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/heatmap/event", new Blob([payload], { type: "application/json" }));
  } else {
    fetch("/api/heatmap/event", { method: "POST", body: payload, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
  }
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function AnalyticsTracker({ projectId }: Props) {
  useEffect(() => {
    // ── visitor / session ID ──────────────────────────────────────────────
    const visitorId = getOrCreate(localStorage,   `lp_vid_${projectId}`);
    const sessionId = getOrCreate(sessionStorage, `lp_sid_${projectId}`);

    // ── page_view ─────────────────────────────────────────────────────────
    sendEvent(projectId, visitorId, sessionId, "page_view");

    // ── scroll_depth ──────────────────────────────────────────────────────
    const sentDepths = new Set<number>();
    const onScroll = () => {
      const el        = document.documentElement;
      const scrolled  = el.scrollTop + el.clientHeight;
      const total     = el.scrollHeight;
      const pct       = total > 0 ? (scrolled / total) * 100 : 0;

      for (const depth of [25, 50, 75, 100]) {
        if (pct >= depth && !sentDepths.has(depth)) {
          sentDepths.add(depth);
          sendEvent(projectId, visitorId, sessionId, "scroll_depth", { depth });

          // Heatmap: スクロール深度も記録
          sendHeatmap(projectId, visitorId, sessionId, "scroll", {
            scrollPct: depth,
            viewportW: window.innerWidth,
            viewportH: window.innerHeight,
            pageH:     total,
          });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    // ── クリック計測（イベントデリゲーション） ────────────────────────────
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const el     = target.closest("a, button, [data-lp-cta]") as HTMLElement | null;
      if (!el) return;

      const tag   = el.tagName.toLowerCase();
      const href  = (el as HTMLAnchorElement).href ?? "";
      const text  = el.textContent?.trim().slice(0, 100) ?? "";
      const isCta = el.hasAttribute("data-lp-cta") ||
                    /cta|btn|button|申し込み|予約|お問い合わせ|LINE|電話|contact/i.test(
                      el.className + " " + text,
                    );

      // 外部リンク
      if (tag === "a" && href && !href.startsWith(location.origin)) {
        sendEvent(projectId, visitorId, sessionId, "outbound_click", { href: href.slice(0, 200), text });
      }

      // CTA クリック
      if (isCta) {
        sendEvent(projectId, visitorId, sessionId, "cta_click", { text, href: href.slice(0, 200) });
      } else if (tag === "button" || tag === "a") {
        sendEvent(projectId, visitorId, sessionId, "button_click", { text, href: href.slice(0, 200) });
      }

      // Heatmap クリック座標
      const pageH  = document.documentElement.scrollHeight;
      const yAbs   = e.pageY;
      sendHeatmap(projectId, visitorId, sessionId, "click", {
        xRatio:    pageH > 0 ? e.pageX / window.innerWidth  : 0,
        yRatio:    pageH > 0 ? yAbs    / pageH               : 0,
        viewportW: window.innerWidth,
        viewportH: window.innerHeight,
        pageH,
        metadata:  { text, tag },
      });
    };
    document.addEventListener("click", onClick);

    // ── フォーム到達計測（form 要素が focus されたら form_open） ──────────
    const formEls = document.querySelectorAll("form, input, textarea, select");
    const sentFormOpen = { done: false };
    const onFormFocus = () => {
      if (sentFormOpen.done) return;
      sentFormOpen.done = true;
      sendEvent(projectId, visitorId, sessionId, "form_open", {});
    };
    formEls.forEach((el) => el.addEventListener("focus", onFormFocus));

    return () => {
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("click", onClick);
      formEls.forEach((el) => el.removeEventListener("focus", onFormFocus));
    };
  }, [projectId]);

  return null; // DOM に何もレンダリングしない
}
