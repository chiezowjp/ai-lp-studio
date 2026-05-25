"use client";

import Link from "next/link";
import { usePlan } from "@/lib/plan-context";
import { trialDaysLeft, EXPORT_PRO_FEATURES } from "@/lib/plans";

interface Props {
  /** ロックされている機能名（例: "HTMLエクスポート"） */
  featureTitle?: string;
  /** アップグレードモーダルを開くコールバック */
  onUpgrade: () => void;
}

/**
 * HTML / CSS / Netlify タブ上に重ねるロックオーバーレイ。
 * トライアル / 期限切れユーザーのエクスポート制限を視覚的に示す。
 */
export default function LockScreen({ featureTitle, onUpgrade }: Props) {
  const { planType, trialEndsAt } = usePlan();
  const days = trialDaysLeft(trialEndsAt);

  const isExpired = planType === "expired";

  return (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-white/85 backdrop-blur-[3px]">
      <div className="flex flex-col items-center gap-4 text-center px-6 max-w-[320px] w-full">

        {/* Icon */}
        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-2xl shadow-sm">
          🔒
        </div>

        {/* Title */}
        <div>
          <h3 className="text-base font-black text-gray-800 mb-1">
            {featureTitle ? `${featureTitle}はProプランで` : "エクスポートはProプランで"}
          </h3>

          {/* Trial countdown */}
          {!isExpired && days !== null && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mt-1
              ${days <= 1
                ? "bg-red-100 text-red-700"
                : days <= 2
                ? "bg-amber-100 text-amber-700"
                : "bg-[#E6F8FC] text-[#007a96]"
              }`}>
              <span>{days === 0 ? "⚠️" : "⏱"}</span>
              <span>{days === 0 ? "本日でトライアル終了" : `トライアル残り ${days} 日`}</span>
            </div>
          )}
          {isExpired && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold mt-1 bg-red-100 text-red-700">
              <span>⚠️</span>
              <span>トライアル終了</span>
            </div>
          )}
        </div>

        {/* Pro features list */}
        <div className="w-full rounded-xl bg-[#F0FBFD] border border-[#b3e8f4] p-3.5 text-left">
          <p className="text-[11px] font-black text-[#007a96] mb-2">Proで解放される機能</p>
          <ul className="space-y-1.5">
            {EXPORT_PRO_FEATURES.map((feat) => (
              <li key={feat} className="flex items-center gap-2 text-xs text-[#007a96]">
                <svg className="w-3.5 h-3.5 shrink-0 text-[#00AFCC]" viewBox="0 0 14 14" fill="none">
                  <circle cx="7" cy="7" r="6.5" fill="#00AFCC" opacity="0.15" />
                  <path d="M4 7l2 2 4-4" stroke="#00AFCC" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {feat}
              </li>
            ))}
          </ul>
        </div>

        {/* CTAs */}
        <div className="flex flex-col gap-2 w-full">
          <button
            onClick={onUpgrade}
            className="w-full py-2.5 bg-[#00AFCC] hover:bg-[#0099b3] text-white text-sm font-black rounded-xl transition-colors shadow-sm"
          >
            アップグレードを確認
          </button>
          <Link
            href="/pricing"
            className="w-full py-2.5 text-center text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-100 transition-colors"
          >
            料金プランを詳しく見る →
          </Link>
        </div>
      </div>
    </div>
  );
}
