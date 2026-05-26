"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePlan } from "@/lib/plan-context";

const MAX_POLLS = 12;      // 最大 12 回 × 5 秒 = 60 秒
const POLL_INTERVAL = 5000; // 5 秒ごと

const PRO_FEATURES = [
  "HTMLコード / CSS をコピー・ダウンロード",
  "LP公開・独自URLで公開",
  "LP保存 10 件・月間 LP 生成 100 回",
  "AI 編集 300 回 / 月",
];

export default function BillingSuccessPage() {
  const { planType, refetch } = usePlan();
  const router = useRouter();
  const [polls, setPolls]       = useState(0);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    // planType が pro になった瞬間に確定
    if (planType === "pro") {
      setConfirmed(true);
      return;
    }
    // 最大ポーリング回数に達したら停止
    if (polls >= MAX_POLLS) return;

    const timer = setTimeout(async () => {
      await refetch();
      setPolls((p) => p + 1);
    }, POLL_INTERVAL);

    return () => clearTimeout(timer);
  }, [planType, polls, refetch]);

  // ── Pro 確定画面 ────────────────────────────────────────────────────────────

  if (confirmed) {
    return (
      <div className="min-h-screen bg-[#F5F5F2] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full flex flex-col items-center gap-6">

          {/* Icon */}
          <div className="w-16 h-16 rounded-2xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-xl shadow-lg">
            Pro
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-xl font-black text-gray-900">Proプランへようこそ！</h1>
            <p className="text-sm text-gray-500 mt-1.5">すべての機能が解放されました</p>
          </div>

          {/* Features */}
          <ul className="w-full bg-[#F0FBFD] border border-[#b3e8f4] rounded-xl p-4 space-y-2">
            {PRO_FEATURES.map((f) => (
              <li key={f} className="flex items-center gap-2 text-sm text-[#007a96]">
                <svg className="w-4 h-4 shrink-0 text-[#00AFCC]" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#00AFCC" opacity="0.15" />
                  <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="#00AFCC" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {f}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <button
            onClick={() => router.push("/")}
            className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099b3] text-white font-black text-sm rounded-xl transition-colors shadow-sm"
          >
            LP作成を始める →
          </button>

          <Link href="/my-lps" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            マイLPを見る
          </Link>
        </div>
      </div>
    );
  }

  // ── ポーリング中 / タイムアウト画面 ────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F2] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full flex flex-col items-center gap-6">

        {/* Spinner */}
        <div className="w-16 h-16 rounded-full bg-[#E6F8FC] flex items-center justify-center">
          <svg className="w-8 h-8 text-[#00AFCC] animate-spin" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
            <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
        </div>

        {/* Message */}
        <div className="text-center">
          <h1 className="text-lg font-black text-gray-900">決済確認中...</h1>
          <p className="text-sm text-gray-500 mt-1.5">
            Proプランを有効化しています。
            <br />少々お待ちください。
          </p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < (polls % 5) + 1 ? "bg-[#00AFCC]" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        {/* Timeout fallback */}
        {polls >= MAX_POLLS && (
          <div className="w-full rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            <p className="font-bold">確認に時間がかかっています</p>
            <p className="mt-1 text-xs leading-relaxed">
              決済が完了している場合、数分後にページを再読み込みしてください。
              改善しない場合はお問い合わせください。
            </p>
            <button
              onClick={() => { setPolls(0); void refetch(); }}
              className="mt-3 px-4 py-2 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
            >
              再確認する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
