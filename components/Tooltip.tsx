"use client";

import { ReactNode } from "react";

/**
 * シンプルなホバー吹き出し（ツールチップ）コンポーネント
 *
 * 使用例:
 *   <Tooltip text="クラウドに保存する">
 *     <button>保存</button>
 *   </Tooltip>
 */
export default function Tooltip({
  text,
  children,
  position = "bottom",
  className = "",
}: {
  /** 表示するテキスト */
  text: string;
  children: ReactNode;
  /** 表示位置（デフォルト: bottom） */
  position?: "top" | "bottom" | "left" | "right";
  className?: string;
}) {
  const pos =
    position === "top"
      ? "bottom-full mb-1.5 left-1/2 -translate-x-1/2"
      : position === "left"
      ? "right-full mr-1.5 top-1/2 -translate-y-1/2"
      : position === "right"
      ? "left-full ml-1.5 top-1/2 -translate-y-1/2"
      : "top-full mt-1.5 left-1/2 -translate-x-1/2"; // bottom (default)

  return (
    <span className={`relative group/tt inline-flex ${className}`}>
      {children}
      <span
        className={`
          pointer-events-none absolute z-[9999] whitespace-nowrap
          ${pos}
          bg-gray-900/90 text-white text-[10px] font-medium leading-tight
          px-2 py-1 rounded-md shadow-lg
          opacity-0 group-hover/tt:opacity-100
          transition-opacity duration-100 delay-[400ms]
        `}
        role="tooltip"
      >
        {text}
      </span>
    </span>
  );
}
