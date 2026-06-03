"use client";

import { usePathname } from "next/navigation";

const HIDDEN_PATHS = ["/p/", "/preview/", "/terms", "/privacy"];

export default function LegalFooter() {
  const pathname = usePathname();
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  return (
    <footer className="shrink-0 py-3 flex justify-center gap-4 text-[11px] text-gray-300">
      <a href="/terms" className="hover:text-gray-500 transition-colors">利用規約</a>
      <a href="/privacy" className="hover:text-gray-500 transition-colors">プライバシーポリシー</a>
      <a href="https://support.ailpstudio.com/" target="_blank" rel="noopener noreferrer" className="hover:text-gray-500 transition-colors">サポート</a>
    </footer>
  );
}
