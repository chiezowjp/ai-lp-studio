"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { PLAN_LIMITS, PLAN_PRICING } from "@/lib/plans";

interface Props {
  open: boolean;
  onClose: () => void;
  reason?: string;
}

/**
 * アップグレード促進モーダル。
 * 「Proにアップグレード」ボタンを押すと Square Checkout へリダイレクトする。
 */
export default function UpgradeModal({ open, onClose, reason }: Props) {
  const { session } = useAuth();
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  if (!open) return null;

  const handleUpgrade = async () => {
    if (!session) {
      setError("ログインが必要です");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? "チェックアウトの作成に失敗しました");
      }
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 flex flex-col gap-4">

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition-colors"
          aria-label="閉じる"
        >✕</button>

        {/* Header */}
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="w-14 h-14 rounded-2xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-lg shadow-lg">
            Pro
          </div>
          <h2 className="text-lg font-black text-gray-900">Pro プランにアップグレード</h2>
          {reason && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 leading-relaxed">
              {reason}
            </p>
          )}
        </div>

        {/* Quick comparison */}
        <div className="rounded-xl border border-gray-100 overflow-hidden text-[12px]">
          <div className="grid grid-cols-3 bg-gray-50 font-semibold text-gray-500 px-4 py-2.5">
            <span>機能</span>
            <span className="text-center">トライアル</span>
            <span className="text-center text-[#00AFCC]">Pro</span>
          </div>
          {([
            ["LP保存数",               `${PLAN_LIMITS.trial.maxProjects}件`,    `${PLAN_LIMITS.pro.maxProjects}件`],
            ["LP生成（月）",            `${PLAN_LIMITS.trial.maxGenerate}回`,    `${PLAN_LIMITS.pro.maxGenerate}回`],
            ["AI編集（月）",            `${PLAN_LIMITS.trial.maxAiEdit}回`,      `${PLAN_LIMITS.pro.maxAiEdit}回`],
            ["HTML / CSSエクスポート",  "✕",                                    "✓"],
            ["Netlifyデプロイ用HTML",   "✕",                                    "✓"],
          ] as [string, string, string][]).map(([feat, trial, pro], i) => (
            <div
              key={feat}
              className={`grid grid-cols-3 px-4 py-2.5 items-center ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
            >
              <span className="text-gray-700 font-medium">{feat}</span>
              <span className="text-center text-gray-400">{trial}</span>
              <span className="text-center font-semibold text-[#00AFCC]">{pro}</span>
            </div>
          ))}
        </div>

        {/* Price */}
        <div className="text-center py-1">
          <span className="text-2xl font-black text-gray-900">{PLAN_PRICING.pro.label}</span>
          <span className="text-sm text-gray-400 ml-1">{PLAN_PRICING.pro.sub}</span>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* CTA */}
        <div className="flex flex-col gap-2.5">
          <button
            onClick={handleUpgrade}
            disabled={loading}
            className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099b3] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-colors shadow-sm flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.3" />
                  <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                チェックアウトを準備中...
              </>
            ) : (
              "Proにアップグレード →"
            )}
          </button>

          <Link
            href="/pricing"
            onClick={onClose}
            className="w-full py-2.5 text-center text-sm font-semibold text-[#00AFCC] bg-[#E6F8FC] hover:bg-[#d0f3fa] border border-[#b3e8f4] rounded-xl transition-colors"
          >
            料金プランの詳細を見る
          </Link>

          <button
            onClick={onClose}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors text-center"
          >
            後で確認する
          </button>
        </div>
      </div>
    </div>
  );
}
