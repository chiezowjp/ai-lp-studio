"use client";

import { useEffect } from "react";

/**
 * custom_head_html の内容を <head> に動的に注入する。
 *
 * dangerouslySetInnerHTML では <script> タグが実行されないため、
 * useEffect で DOM 操作して注入する。
 * GA・Meta Pixel・Search Console meta などに対応。
 *
 * セキュリティ注意:
 * - custom_head_html は Pro ユーザー（認証済み）のみが設定可能
 * - 内容はユーザー自身のコードであり、サードパーティユーザーへの
 *   XSS リスクは許容範囲内とみなす（SaaS の慣行と同様）
 */
export function HeadInjector({ html }: { html: string }) {
  useEffect(() => {
    if (!html.trim()) return;

    const injected: Element[] = [];

    const template = document.createElement("div");
    template.innerHTML = html;

    for (const child of Array.from(template.children)) {
      if (child.tagName === "SCRIPT") {
        // innerHTML では script は実行されないため createElement で再作成
        const script = document.createElement("script");
        const src = child.getAttribute("src");
        if (src) script.src = src;
        if (child.hasAttribute("async")) script.async = true;
        if (child.hasAttribute("defer")) script.defer = true;
        const type = child.getAttribute("type");
        if (type) script.type = type;
        if (!src) script.textContent = child.textContent;
        document.head.appendChild(script);
        injected.push(script);
      } else {
        const cloned = child.cloneNode(true) as Element;
        document.head.appendChild(cloned);
        injected.push(cloned);
      }
    }

    // アンマウント時にクリーンアップ（SPA ナビゲーション対応）
    return () => {
      for (const el of injected) {
        if (el.parentNode) el.parentNode.removeChild(el);
      }
    };
  }, [html]);

  return null;
}
