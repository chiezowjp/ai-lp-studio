"use client";

import Link from "next/link";
import { usePlan } from "@/lib/plan-context";
import { trialDaysLeft } from "@/lib/plans";

/**
 * グローバルバナー。
 * PlanProvider の直下に配置し、全ページ共通で表示する。
 *
 * 表示条件:
 *   - past_due  → 支払い失敗警告（猶予期間中）
 *   - past_due + grace 超過 → 利用停止警告（expired 扱い）
 *
 * trial 残り日数や expired バナーは各ページで個別に表示するため、
 * ここでは課金エラー系のみを担当する。
 */
export function GlobalBanners() {
  const { billingStatus, gracePeriodEndsAt, planType, trialEndsAt } = usePlan();

  const now = new Date();
  const graceExpired = gracePeriodEndsAt !== null && gracePeriodEndsAt < now;
  const graceDaysLeft = gracePeriodEndsAt
    ? Math.max(0, Math.ceil((gracePeriodEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;
  const trialDays = trialDaysLeft(trialEndsAt);

  // ── past_due: Grace Period 超過 → 利用停止バナー ──────────────────────────
  if (billingStatus === "past_due" && graceExpired) {
    return (
      <div className="w-full bg-red-600 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
        <span>🔒</span>
        <span className="font-semibold">
          お支払いの猶予期間が終了しました。Proプランの機能がロックされています。
        </span>
        <Link
          href="/billing"
          className="shrink-0 px-3 py-1 bg-white text-red-600 font-black text-xs rounded-lg hover:bg-red-50 transition-colors"
        >
          支払い方法を更新
        </Link>
      </div>
    );
  }

  // ── past_due: Grace Period 内 → 警告バナー ────────────────────────────────
  if (billingStatus === "past_due" && !graceExpired) {
    return (
      <div className="w-full bg-amber-500 text-white px-4 py-2.5 flex items-center justify-center gap-3 text-sm">
        <span>⚠️</span>
        <span className="font-semibold">
          お支払いを確認できませんでした。
          {graceDaysLeft !== null && graceDaysLeft > 0
            ? `${graceDaysLeft}日以内にお支払い方法を更新してください。`
            : "本日中にお支払い方法を更新してください。"}
        </span>
        <Link
          href="/billing"
          className="shrink-0 px-3 py-1 bg-white text-amber-600 font-black text-xs rounded-lg hover:bg-amber-50 transition-colors"
        >
          確認する
        </Link>
      </div>
    );
  }

  // ── canceled: 解約済み（期限内） → 情報バナー ─────────────────────────────
  if (billingStatus === "canceled" && planType === "pro") {
    return (
      <div className="w-full bg-gray-700 text-white px-4 py-2 flex items-center justify-center gap-3 text-xs">
        <span>📅</span>
        <span>
          Proプランは解約済みです。利用期限まではすべての機能をご利用いただけます。
        </span>
        <Link
          href="/billing"
          className="shrink-0 underline hover:no-underline opacity-80 hover:opacity-100"
        >
          詳細
        </Link>
      </div>
    );
  }

  // ── trial: 残り1日以内 → 緊急バナー ──────────────────────────────────────
  if (billingStatus === "trialing" && trialDays !== null && trialDays <= 1) {
    return (
      <div className="w-full bg-red-500 text-white px-4 py-2 flex items-center justify-center gap-3 text-sm">
        <span>⏱</span>
        <span className="font-semibold">
          {trialDays === 0
            ? "本日でトライアルが終了します。"
            : "トライアル残り1日です。"}
        </span>
        <Link
          href="/pricing"
          className="shrink-0 px-3 py-1 bg-white text-red-600 font-black text-xs rounded-lg hover:bg-red-50 transition-colors"
        >
          Proにする
        </Link>
      </div>
    );
  }

  return null;
}
