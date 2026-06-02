"use client";

/**
 * LP HTML をレンダリングするクライアントコンポーネント。
 */
export default function LPRenderer({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}
