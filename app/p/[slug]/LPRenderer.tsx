"use client";

import { useEffect, useRef } from "react";

/**
 * LP HTML をレンダリングし、<script> タグを実行するクライアントコンポーネント。
 * React の dangerouslySetInnerHTML は <script> を実行しないため、
 * マウント後に script 要素を再生成して実行する。
 */
export default function LPRenderer({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = ref.current;
    if (!container) return;

    // <script> タグを再生成して実行（dangerouslySetInnerHTML では実行されないため）
    container.querySelectorAll("script").forEach((original) => {
      const script = document.createElement("script");
      // インラインスクリプト
      if (original.textContent) script.textContent = original.textContent;
      // 外部スクリプト
      if (original.src) script.src = original.src;
      if (original.type) script.type = original.type;
      original.parentNode?.replaceChild(script, original);
    });
  }, []);

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
