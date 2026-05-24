"use client";

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import type { PlanType, UsageCounts, BillingStatus } from "@/lib/plans";
import { GRACE_PERIOD_DAYS } from "@/lib/plans";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanProfile {
  plan_type: PlanType;
  trial_ends_at: string | null;
  is_admin: boolean;
  // Phase 4 — 課金情報
  billing_status: BillingStatus | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  plan_started_at: string | null;
  usage_reset_at: string | null;
}

interface PlanContextValue {
  /** 現在のプラン。null = 未取得 / 未ログイン */
  planType: PlanType | null;
  /** トライアル終了日時 */
  trialEndsAt: Date | null;
  /** 管理者フラグ */
  isAdmin: boolean;
  /** 今月（または usage_reset_at 以降）の使用量 */
  usage: UsageCounts;
  /** 読み込み中フラグ */
  loading: boolean;
  /** Square 課金ステータス */
  billingStatus: BillingStatus | null;
  /** Pro の現在の請求期間終了日 */
  currentPeriodEnd: Date | null;
  /** 支払い失敗時の猶予期間終了日 */
  gracePeriodEndsAt: Date | null;
  /** プロファイル・使用量を再取得する */
  refetch: () => Promise<void>;
  /** 使用イベントを記録する（楽観的に usage を更新）*/
  recordUsage: (type: keyof UsageCounts) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const PlanContext = createContext<PlanContextValue>({
  planType: null,
  trialEndsAt: null,
  isAdmin: false,
  usage: { generate: 0, analyze: 0, ai_edit: 0 },
  loading: false,
  billingStatus: null,
  currentPeriodEnd: null,
  gracePeriodEndsAt: null,
  refetch: async () => {},
  recordUsage: async () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function PlanProvider({ children }: { children: ReactNode }) {
  const { user, session } = useAuth();

  const [profile, setProfile] = useState<PlanProfile | null>(null);
  const [usage, setUsage]     = useState<UsageCounts>({ generate: 0, analyze: 0, ai_edit: 0 });
  const [loading, setLoading] = useState(false);

  // session ref（コールバック内で常に最新値を参照）
  const sessionRef = useRef(session);
  sessionRef.current = session;

  const fetchAll = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${s.access_token}` };
      const [profRes, usageRes] = await Promise.all([
        fetch("/api/profile", { headers }),
        fetch("/api/usage",   { headers }),
      ]);
      if (profRes.ok)  setProfile(await profRes.json() as PlanProfile);
      if (usageRes.ok) setUsage(await usageRes.json() as UsageCounts);
    } catch {
      // エラー時はサイレントに無視（UI を壊さない）
    } finally {
      setLoading(false);
    }
  }, []);

  // ログイン / ログアウト時に取得
  useEffect(() => {
    if (user && session) {
      void fetchAll();
    } else {
      setProfile(null);
      setUsage({ generate: 0, analyze: 0, ai_edit: 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /** 使用イベントを記録し、ローカルカウンタを楽観的更新する */
  const recordUsage = useCallback(async (type: keyof UsageCounts) => {
    const s = sessionRef.current;
    if (!s) return;
    // 楽観的更新
    setUsage((prev) => ({ ...prev, [type]: prev[type] + 1 }));
    try {
      await fetch("/api/usage", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.access_token}` },
        body: JSON.stringify({ event_type: type }),
      });
    } catch {
      // 失敗時はサイレント（次回 refetch で正しい値になる）
    }
  }, []);

  // ─── 有効プランタイプの計算 ───────────────────────────────────────────────
  //
  // plan_type は DB の値だが、以下の期限を前端で評価して effective な値を返す:
  //
  // 1. trial + trial_ends_at 超過     → expired
  // 2. pro + past_due + grace 超過    → expired（猶予期間終了）
  // 3. pro + canceled + period 超過   → expired（解約後の利用期限終了）
  //
  // Webhook が即時に plan_type を書き換えるわけではないため、
  // フロントで評価することで即時・正確な制限を実現する。

  const effectivePlanType: PlanType | null = (() => {
    if (!profile) return null;
    const now = new Date();

    // ── Trial 期限切れ
    if (profile.plan_type === "trial" && profile.trial_ends_at) {
      if (new Date(profile.trial_ends_at) < now) return "expired";
    }

    // ── Pro: 支払い失敗 → Grace Period チェック
    if (
      profile.plan_type === "pro" &&
      profile.billing_status === "past_due" &&
      profile.grace_period_ends_at
    ) {
      if (new Date(profile.grace_period_ends_at) < now) return "expired";
      // Grace Period 内は Pro として扱う
      return "pro";
    }

    // ── Pro: 解約済み → 利用期限チェック
    if (
      profile.plan_type === "pro" &&
      profile.billing_status === "canceled" &&
      profile.current_period_end
    ) {
      if (new Date(profile.current_period_end) < now) return "expired";
      // 期限内は Pro として扱う
      return "pro";
    }

    return profile.plan_type;
  })();

  const trialEndsAt      = profile?.trial_ends_at      ? new Date(profile.trial_ends_at)      : null;
  const currentPeriodEnd = profile?.current_period_end ? new Date(profile.current_period_end) : null;
  const gracePeriodEndsAt = profile?.grace_period_ends_at
    ? new Date(profile.grace_period_ends_at)
    : null;

  // billing_status が DB にない場合（Phase 4b SQL 未適用）は null のまま
  const billingStatus = (profile?.billing_status ?? null) as BillingStatus | null;

  return (
    <PlanContext.Provider
      value={{
        planType: effectivePlanType,
        trialEndsAt,
        isAdmin: profile?.is_admin ?? false,
        usage,
        loading,
        billingStatus,
        currentPeriodEnd,
        gracePeriodEndsAt,
        refetch: fetchAll,
        recordUsage,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePlan() {
  return useContext(PlanContext);
}
