"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LAST_READ_KEY = "lastReadNewsAt";

function useUnreadNews() {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((items: { published_at: string }[]) => {
        if (!items.length) return;
        const latest = items[0].published_at;
        const lastRead = localStorage.getItem(LAST_READ_KEY);
        setHasUnread(!lastRead || latest > lastRead);
      })
      .catch(() => {});
  }, []);

  return hasUnread;
}

/** ドロップダウン内のお知らせ項目（赤丸付き） */
export function NewsDropdownItem() {
  const router = useRouter();
  const hasUnread = useUnreadNews();

  return (
    <button
      onClick={() => router.push("/news")}
      className="relative w-full text-left px-3 py-2.5 text-xs hover:bg-gray-50 transition-colors font-semibold text-gray-700"
    >
      🔔 お知らせ
      {hasUnread && (
        <span className="absolute top-2 left-[3.5rem] w-2 h-2 bg-red-500 rounded-full" />
      )}
    </button>
  );
}

/** 旧：ヘッダー直置きボタン（後方互換のため残す） */
export default function NewsBell() {
  const router = useRouter();
  const hasUnread = useUnreadNews();

  return (
    <button
      onClick={() => router.push("/news")}
      className="relative hidden sm:flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
    >
      🔔 お知らせ
      {hasUnread && (
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
      )}
    </button>
  );
}
