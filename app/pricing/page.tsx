"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePlan } from "@/lib/plan-context";
import {
  PLAN_FEATURES,
  PLAN_PRICING,
  PLAN_LIMITS,
  PLAN_LABEL,
  trialDaysLeft,
  type PlanType,
  type FeatureValue,
} from "@/lib/plans";

// ─── Feature Value Display ─────────────────────────────────────────────────────

function FeatureCell({
  value,
  isPro,
  comingSoon,
}: {
  value: FeatureValue;
  isPro?: boolean;
  comingSoon?: boolean;
}) {
  if (value === true) {
    return (
      <span className={`inline-flex items-center gap-1 text-sm font-semibold ${isPro ? "text-[#00AFCC]" : "text-gray-600"}`}>
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 16 16" fill="none">
          <circle cx="8" cy="8" r="7" fill={isPro ? "#00AFCC" : "#6B7280"} opacity="0.15" />
          <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke={isPro ? "#00AFCC" : "#6B7280"} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {comingSoon && <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">準備中</span>}
      </span>
    );
  }
  if (value === false) {
    return <span className="text-sm text-gray-300 font-medium">—</span>;
  }
  return (
    <span className={`text-sm font-semibold ${isPro ? "text-[#00AFCC]" : "text-gray-600"}`}>
      {value}
      {comingSoon && <span className="ml-1 text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">準備中</span>}
    </span>
  );
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  planKey,
  currentPlan,
  trialDays,
  onUpgradeClick,
  upgradeLoading,
}: {
  planKey: "trial" | "pro";
  currentPlan: PlanType | null;
  trialDays: number | null;
  onUpgradeClick: () => void;
  upgradeLoading?: boolean;
}) {
  const isPro = planKey === "pro";
  const pricing = PLAN_PRICING[planKey];
  const limits = PLAN_LIMITS[planKey];
  const isCurrent = currentPlan === planKey || (currentPlan === "expired" && planKey === "trial");

  const highlights = PLAN_FEATURES.filter((f) => f.highlight);

  return (
    <div
      className={`relative flex flex-col rounded-2xl border-2 p-6 transition-shadow
        ${isPro
          ? "border-[#00AFCC] shadow-[0_0_0_4px_rgba(0,175,204,0.08)] bg-white"
          : "border-gray-200 bg-white"
        }`}
    >
      {/* Badge */}
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="px-3 py-1 bg-[#00AFCC] text-white text-[11px] font-black rounded-full shadow-sm tracking-wide">
            おすすめ
          </span>
        </div>
      )}

      {/* Plan name */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black
          ${isPro ? "bg-[#00AFCC] text-white" : "bg-gray-100 text-gray-600"}`}>
          {isPro ? "Pro" : "T"}
        </div>
        <span className="font-black text-gray-900 text-base">
          {isPro ? "Pro プラン" : "トライアル"}
        </span>
        {isCurrent && (
          <span className="ml-auto text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            現在のプラン
          </span>
        )}
      </div>

      {/* Price */}
      <div className="mb-5">
        <div className="flex items-baseline gap-1">
          <span className={`text-4xl font-black ${isPro ? "text-gray-900" : "text-gray-900"}`}>
            {pricing.label}
          </span>
          <span className="text-sm text-gray-400 font-medium">{pricing.sub}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">{pricing.desc}</p>

        {/* Trial countdown */}
        {!isPro && trialDays !== null && currentPlan === "trial" && (
          <div className={`mt-3 rounded-xl px-3 py-2 text-xs font-semibold
            ${trialDays <= 1
              ? "bg-red-50 border border-red-200 text-red-700"
              : trialDays <= 2
              ? "bg-amber-50 border border-amber-200 text-amber-700"
              : "bg-[#E6F8FC] border border-[#b3e8f4] text-[#007a96]"
            }`}>
            {trialDays === 0
              ? "⚠️ 本日でトライアル終了です"
              : `⏱ トライアル残り ${trialDays} 日`}
          </div>
        )}
        {!isPro && currentPlan === "expired" && (
          <div className="mt-3 rounded-xl px-3 py-2 text-xs font-semibold bg-red-50 border border-red-200 text-red-700">
            ⚠️ トライアル期間が終了しました
          </div>
        )}
      </div>

      {/* Key highlights */}
      <ul className="space-y-2.5 mb-6 flex-1">
        {highlights.map((f) => {
          const value = isPro ? f.pro : f.trial;
          const enabled = value !== false;
          return (
            <li key={f.label} className="flex items-center gap-2.5 text-sm">
              {enabled ? (
                <svg className={`w-4 h-4 shrink-0 ${isPro ? "text-[#00AFCC]" : "text-gray-400"}`} viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="currentColor" opacity="0.15" />
                  <path d="M4.5 8l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg className="w-4 h-4 shrink-0 text-gray-200" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.2" />
                  <path d="M5.5 8h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              )}
              <span className={enabled ? "text-gray-700" : "text-gray-300 line-through"}>
                {typeof value === "string" ? `${f.label} ${value}` : f.label}
              </span>
              {f.comingSoon && enabled && (
                <span className="text-[9px] font-bold bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full">準備中</span>
              )}
            </li>
          );
        })}
      </ul>

      {/* CTA */}
      {isPro ? (
        <button
          onClick={onUpgradeClick}
          disabled={upgradeLoading}
          className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099b3] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-colors shadow-sm"
        >
          {upgradeLoading ? "チェックアウトを準備中..." : "Proにアップグレード"}
        </button>
      ) : isCurrent && currentPlan === "trial" ? (
        <div className="w-full py-3 text-center text-sm text-gray-400 font-semibold bg-gray-50 rounded-xl border border-gray-100">
          現在ご利用中
        </div>
      ) : (
        <Link
          href="/"
          className="block w-full py-3 text-center text-sm font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-xl border border-gray-100 transition-colors"
        >
          エディターへ
        </Link>
      )}
    </div>
  );
}


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const router = useRouter();
  const { user, session, signInWithGoogle } = useAuth();
  const { planType, trialEndsAt, loading } = usePlan();
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError]     = useState<string | null>(null);

  const days = trialDaysLeft(trialEndsAt);

  const handleUpgrade = useCallback(async () => {
    if (!session) {
      signInWithGoogle();
      return;
    }
    setCheckoutLoading(true);
    setCheckoutError(null);
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
      setCheckoutError(e instanceof Error ? e.message : "エラーが発生しました");
      setCheckoutLoading(false);
    }
  }, [session, signInWithGoogle]);

  // カテゴリごとにグループ化
  const grouped = PLAN_FEATURES.reduce<{ category: string; features: typeof PLAN_FEATURES }[]>((acc, f) => {
    const cat = f.category ?? "";
    const last = acc[acc.length - 1];
    if (last && last.category === cat) {
      last.features.push(f);
    } else {
      acc.push({ category: cat, features: [f] });
    }
    return acc;
  }, []);

  return (
    <div className="min-h-screen bg-[#F5F5F2]">

      {/* ── Header ── */}
      <header className="bg-[#F7F7F4] border-b border-[#D8D8D2] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-[11px] shrink-0"
          >
            AI
          </button>
          <h1 className="text-[15px] font-black text-gray-900 tracking-[0.15em] flex-1">
            AI LP STUDIO
          </h1>
          {!user ? (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              ログイン
            </button>
          ) : (
            <Link
              href="/"
              className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
            >
              ← エディターに戻る
            </Link>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-12">

        {/* ── Hero ── */}
        <div className="text-center mb-10">
          <p className="text-xs font-bold text-[#00AFCC] tracking-widest uppercase mb-3">Pricing</p>
          <h2 className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight mb-3">
            シンプルな料金プラン
          </h2>
          <p className="text-sm text-gray-500 leading-relaxed">
            まずは3日間無料でお試しください。<br className="sm:hidden" />
            必要なときにいつでもProにアップグレードできます。
          </p>
        </div>

        {/* ── Checkout error ── */}
        {checkoutError && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 px-5 py-3 text-sm text-red-600">
            {checkoutError}
          </div>
        )}

        {/* ── Trial alert ── */}
        {!loading && planType === "trial" && days !== null && (
          <div className={`mb-8 rounded-2xl px-5 py-4 flex items-center gap-3 border
            ${days <= 1
              ? "bg-red-50 border-red-200"
              : days <= 2
              ? "bg-amber-50 border-amber-200"
              : "bg-[#E6F8FC] border-[#b3e8f4]"
            }`}>
            <span className="text-xl shrink-0">{days === 0 ? "⚠️" : "⏱"}</span>
            <div className="flex-1">
              <p className={`text-sm font-black
                ${days <= 1 ? "text-red-800" : days <= 2 ? "text-amber-800" : "text-[#007a96]"}`}>
                {days === 0 ? "本日でトライアル終了です" : `トライアル期間 残り ${days} 日`}
              </p>
              <p className={`text-xs mt-0.5
                ${days <= 1 ? "text-red-600" : days <= 2 ? "text-amber-600" : "text-[#00AFCC]"}`}>
                Proにアップグレードすることでエクスポートなどの全機能が使えます
              </p>
            </div>
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              className="shrink-0 px-4 py-2 bg-[#00AFCC] hover:bg-[#0099b3] disabled:opacity-60 text-white text-xs font-black rounded-xl transition-colors"
            >
              {checkoutLoading ? "..." : "アップグレード"}
            </button>
          </div>
        )}

        {!loading && planType === "expired" && (
          <div className="mb-8 rounded-2xl px-5 py-4 flex items-center gap-3 bg-red-50 border border-red-200">
            <span className="text-xl shrink-0">🔒</span>
            <div className="flex-1">
              <p className="text-sm font-black text-red-800">トライアル期間が終了しました</p>
              <p className="text-xs text-red-600 mt-0.5">
                引き続きご利用いただくにはProプランへのアップグレードが必要です
              </p>
            </div>
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              className="shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white text-xs font-black rounded-xl transition-colors"
            >
              {checkoutLoading ? "..." : "アップグレード"}
            </button>
          </div>
        )}

        {/* ── Plan Cards ── */}
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-6 mb-12 max-w-2xl mx-auto">
          <PlanCard
            planKey="trial"
            currentPlan={planType}
            trialDays={days}
            onUpgradeClick={() => void handleUpgrade()}
            upgradeLoading={checkoutLoading}
          />
          <PlanCard
            planKey="pro"
            currentPlan={planType}
            trialDays={days}
            onUpgradeClick={() => void handleUpgrade()}
            upgradeLoading={checkoutLoading}
          />
        </div>

        {/* ── Feature Comparison Table ── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-10">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-black text-gray-900">機能比較</h3>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1fr_100px_100px] px-6 py-3 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500">
            <span>機能</span>
            <span className="text-center">トライアル</span>
            <span className="text-center text-[#00AFCC]">Pro</span>
          </div>

          {grouped.map(({ category, features }) => (
            <div key={category}>
              {category && (
                <div className="px-6 py-2 bg-gray-50/70 border-b border-gray-50">
                  <p className="text-[11px] font-black text-gray-400 uppercase tracking-wider">{category}</p>
                </div>
              )}
              {features.map((f, i) => (
                <div
                  key={f.label}
                  className={`grid grid-cols-[1fr_100px_100px] px-6 py-3 items-center border-b border-gray-50 last:border-0
                    ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
                >
                  <span className="text-sm text-gray-700 font-medium">{f.label}</span>
                  <div className="flex justify-center">
                    <FeatureCell value={f.trial} comingSoon={f.comingSoon} />
                  </div>
                  <div className="flex justify-center">
                    <FeatureCell value={f.pro} isPro comingSoon={f.comingSoon} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ── FAQ / Notes ── */}
        <div className="grid sm:grid-cols-2 gap-4 mb-10">
          {[
            {
              q: "トライアル終了後はどうなりますか？",
              a: "編集・エクスポート機能がロックされます。プレビューとマイLP閲覧は引き続きご利用いただけます。"
            },
            {
              q: "いつでも解約できますか？",
              a: "はい、いつでも解約可能です。解約後は次の更新日まで引き続きご利用いただけます。"
            },
            {
              q: "商用利用は可能ですか？",
              a: "はい、トライアル・Proともに商用利用OKです。生成したLPはお客様のビジネスに自由にご利用いただけます。"
            },
            {
              q: "サポートはありますか？",
              a: "Proプラン向けにメールサポートを予定しています。詳細はProプラン公開時にお知らせします。"
            },
          ].map(({ q, a }) => (
            <div key={q} className="bg-white rounded-xl border border-gray-100 px-5 py-4">
              <p className="text-sm font-bold text-gray-800 mb-1.5">{q}</p>
              <p className="text-xs text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* ── Bottom CTA ── */}
        <div className="text-center">
          <div className="inline-flex flex-col items-center gap-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-8 py-6">
            <div className="w-12 h-12 rounded-2xl bg-[#00AFCC] flex items-center justify-center text-white font-black shadow-md">
              Pro
            </div>
            <div>
              <p className="font-black text-gray-900 text-base">Proプランで全機能を解放</p>
              <p className="text-xs text-gray-400 mt-1">月額 {PLAN_PRICING.pro.label}（税込）</p>
            </div>
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              className="px-8 py-3 bg-[#00AFCC] hover:bg-[#0099b3] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-colors shadow-sm"
            >
              {checkoutLoading ? "チェックアウトを準備中..." : "アップグレードを申し込む"}
            </button>
            <Link href="/" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              ← エディターに戻る
            </Link>
          </div>
        </div>

      </main>
    </div>
  );
}
