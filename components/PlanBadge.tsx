"use client";

import Link from "next/link";
import { usePlan } from "@/lib/plan-context";
import { PLAN_LABEL, PLAN_BADGE_COLOR, trialDaysLeft } from "@/lib/plans";

/**
 * ヘッダーに表示するプランバッジ。
 * クリックすると /pricing へ遷移する。
 * 未ログイン / プラン未取得の場合は何も表示しない。
 */
export default function PlanBadge() {
  const { planType, trialEndsAt, loading } = usePlan();

  if (loading || !planType) return null;

  const label = PLAN_LABEL[planType];
  const color = PLAN_BADGE_COLOR[planType];
  const days  = trialDaysLeft(trialEndsAt);

  // 残り日数が少ない場合は強調
  const isUrgent = planType === "trial" && days !== null && days <= 1;
  const isExpired = planType === "expired";

  return (
    <Link
      href="/pricing"
      title="料金プランを見る"
      className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-opacity hover:opacity-80 ${color}
        ${isUrgent || isExpired ? "animate-pulse" : ""}`}
    >
      <span>{label}</span>
      {planType === "trial" && days !== null && (
        <span className="opacity-70">
          {days === 0 ? "最終日" : `残${days}日`}
        </span>
      )}
    </Link>
  );
}
