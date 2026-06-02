"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const LAST_READ_KEY = "lastReadNewsAt";

export default function NewsBell() {
  const router = useRouter();
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
