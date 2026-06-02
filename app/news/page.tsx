"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface NewsItem {
  id: string;
  title: string;
  content: string;
  type: "info" | "update" | "maintenance";
  published_at: string;
}

const TYPE_LABEL: Record<string, { label: string; cls: string }> = {
  info:        { label: "お知らせ",   cls: "bg-blue-100 text-blue-700" },
  update:      { label: "アップデート", cls: "bg-green-100 text-green-700" },
  maintenance: { label: "メンテナンス", cls: "bg-amber-100 text-amber-700" },
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });
}

const LAST_READ_KEY = "lastReadNewsAt";

export default function NewsPage() {
  const router = useRouter();
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => r.json())
      .then((data: NewsItem[]) => {
        setItems(data);
        // 既読マークとして現在時刻を保存
        if (data.length > 0) {
          localStorage.setItem(LAST_READ_KEY, new Date().toISOString());
        }
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      {/* Header */}
      <header className="bg-[#F7F7F4] border-b border-[#D8D8D2] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <img src="/logo.png" alt="AI LP STUDIO" className="h-8 w-auto shrink-0 cursor-pointer" onClick={() => router.push("/")} />
          <h1 className="text-[15px] font-black text-gray-900 tracking-[0.15em] flex-1">
            お知らせ
          </h1>
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← エディターに戻る
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {loading ? (
          <div className="text-center py-16 text-gray-400 text-sm">読み込み中...</div>
        ) : items.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">お知らせはまだありません</div>
        ) : (
          <div className="space-y-4">
            {items.map((item) => {
              const { label, cls } = TYPE_LABEL[item.type] ?? TYPE_LABEL.info;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${cls}`}>
                      {label}
                    </span>
                    <span className="text-[11px] text-gray-400">{fmtDate(item.published_at)}</span>
                  </div>
                  <p className="text-sm font-black text-gray-900 mb-2">{item.title}</p>
                  <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-wrap">{item.content}</p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
