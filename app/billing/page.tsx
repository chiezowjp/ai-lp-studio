"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePlan } from "@/lib/plan-context";
import { PLAN_LABEL, SQUARE_PRO_MONTHLY_PRICE_LABEL, trialDaysLeft } from "@/lib/plans";
import type { BillingStatus } from "@/lib/plans";

// ─── Types ────────────────────────────────────────────────────────────────────

interface BillingEvent {
  id: string;
  square_event_id: string;
  event_type: string;
  billing_status: string | null;
  amount: number | null;
  currency: string | null;
  processed_at: string;
}

interface BillingStatusData {
  plan_type: string;
  billing_status: BillingStatus | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  canceled_at: string | null;
  square_subscription_id: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("ja-JP", {
    year: "numeric", month: "long", day: "numeric",
  });
}

function fmtAmount(amount: number | null, currency: string | null): string {
  if (amount === null) return "—";
  const cur = currency ?? "JPY";
  return new Intl.NumberFormat("ja-JP", { style: "currency", currency: cur }).format(amount);
}

function BillingStatusBadge({ status }: { status: BillingStatus | null }) {
  if (!status) return <span className="text-gray-400 text-xs">—</span>;

  const map: Record<string, { label: string; cls: string }> = {
    trialing: { label: "トライアル中",  cls: "bg-amber-100 text-amber-700" },
    active:   { label: "有効",          cls: "bg-green-100 text-green-700" },
    canceled: { label: "解約済み",      cls: "bg-gray-100  text-gray-600"  },
    past_due: { label: "支払い失敗",    cls: "bg-red-100   text-red-600"   },
    expired:  { label: "期限切れ",      cls: "bg-red-100   text-red-700"   },
    none:     { label: "未設定",        cls: "bg-gray-100  text-gray-400"  },
  };

  const { label, cls } = map[status] ?? { label: status, cls: "bg-gray-100 text-gray-500" };
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

function EventTypeLabel({ type }: { type: string }) {
  const map: Record<string, string> = {
    "payment.created":          "決済作成",
    "payment.updated":          "決済更新",
    "subscription.updated":     "サブスク更新",
    "subscription.deleted":     "サブスク削除",
    "subscription.canceled":    "サブスクキャンセル",
  };
  return <span>{map[type] ?? type}</span>;
}

// ─── Cancel Confirm Modal ─────────────────────────────────────────────────────

function CancelModal({
  onConfirm,
  onClose,
  loading,
  periodEnd,
}: {
  onConfirm: () => void;
  onClose: () => void;
  loading: boolean;
  periodEnd: string | null;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 flex flex-col gap-4">
        <h2 className="text-base font-black text-gray-900">Proプランを解約しますか？</h2>
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 space-y-1">
          <p className="font-bold">解約後について</p>
          <ul className="text-xs space-y-0.5 list-disc list-inside">
            <li>即時に利用停止にはなりません</li>
            {periodEnd && (
              <li>{fmtDate(periodEnd)} まで引き続きProをご利用いただけます</li>
            )}
            <li>期限後はエクスポート・編集機能がロックされます</li>
            <li>保存済みのLPデータは削除されません</li>
          </ul>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
          >
            キャンセル
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex-1 py-2.5 text-sm font-black bg-red-500 hover:bg-red-600 disabled:opacity-60 text-white rounded-xl transition-colors"
          >
            {loading ? "処理中..." : "解約する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const { session, user, loading: authLoading, signInWithGoogle } = useAuth();
  const { planType, billingStatus, currentPeriodEnd, gracePeriodEndsAt, trialEndsAt, refetch } = usePlan();
  const router = useRouter();

  const [billingData, setBillingData]   = useState<BillingStatusData | null>(null);
  const [events, setEvents]             = useState<BillingEvent[]>([]);
  const [fetching, setFetching]         = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [showCancel, setShowCancel]     = useState(false);
  const [canceling, setCanceling]       = useState(false);
  const [cancelError, setCancelError]   = useState<string | null>(null);
  const [cancelSuccess, setCancelSuccess] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const trialDays = trialDaysLeft(trialEndsAt);
  const now = new Date();
  const graceExpired = gracePeriodEndsAt !== null && gracePeriodEndsAt < now;
  const graceDaysLeft = gracePeriodEndsAt
    ? Math.max(0, Math.ceil((gracePeriodEndsAt.getTime() - now.getTime()) / 86_400_000))
    : null;

  // ── データ取得 ─────────────────────────────────────────────────────────────

  const fetchBilling = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${session.access_token}` };
      const [statusRes, eventsRes] = await Promise.all([
        fetch("/api/billing/status", { headers }),
        fetch("/api/billing/events", { headers }),
      ]);
      if (statusRes.ok)  setBillingData(await statusRes.json() as BillingStatusData);
      if (eventsRes.ok)  setEvents(await eventsRes.json() as BillingEvent[]);
    } catch {
      setError("課金情報の取得に失敗しました");
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    if (!authLoading && session) void fetchBilling();
  }, [authLoading, session, fetchBilling]);

  // ── 解約処理 ──────────────────────────────────────────────────────────────

  const handleCancel = async () => {
    if (!session) return;
    setCanceling(true);
    setCancelError(null);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? "解約処理に失敗しました");
      }
      setShowCancel(false);
      setCancelSuccess(true);
      await refetch();
      await fetchBilling();
    } catch (e) {
      setCancelError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setCanceling(false);
    }
  };

  // ── チェックアウト ────────────────────────────────────────────────────────

  const handleUpgrade = async () => {
    if (!session) return;
    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("チェックアウトの作成に失敗しました");
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch {
      setCheckoutLoading(false);
    }
  };

  // ── ログイン前 ────────────────────────────────────────────────────────────

  if (authLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 bg-[#F5F5F2]">
        <p className="text-gray-500 text-sm">課金情報を確認するにはログインしてください</p>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          Google でログイン
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      {showCancel && (
        <CancelModal
          onConfirm={handleCancel}
          onClose={() => setShowCancel(false)}
          loading={canceling}
          periodEnd={billingData?.current_period_end ?? null}
        />
      )}

      {/* Header */}
      <header className="bg-[#F7F7F4] border-b border-[#D8D8D2] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center gap-3">
          <img src="/logo.png" alt="AI LP STUDIO" className="h-8 w-auto shrink-0 cursor-pointer" onClick={() => router.push("/")} />
          <h1 className="text-[15px] font-black text-gray-900 tracking-[0.15em] flex-1">
            課金・プラン管理
          </h1>
          <Link href="/pricing" className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            料金プランを見る →
          </Link>
          <Link href="/" className="text-xs font-semibold border border-gray-200 px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">
            ← エディターへ
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-5">

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{error}</div>
        )}

        {cancelSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-semibold">
            解約を受け付けました。利用期限まで引き続きProをご利用いただけます。
          </div>
        )}

        {cancelError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">{cancelError}</div>
        )}

        {/* ── プラン概要 ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-sm font-black text-gray-700 mb-4">現在のプラン</h2>

          <div className="flex items-center gap-3 mb-5">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-sm font-black
              ${planType === "pro" ? "bg-[#00AFCC] text-white" : "bg-gray-100 text-gray-600"}`}>
              {planType === "pro" ? "Pro" : planType === "trial" ? "T" : "✕"}
            </div>
            <div>
              <p className="font-black text-gray-900 text-base">
                {planType ? PLAN_LABEL[planType] : "—"}
                {planType === "pro" && billingStatus === "canceled" && (
                  <span className="ml-2 text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">解約済み</span>
                )}
              </p>
              {planType === "pro" && (
                <p className="text-xs text-gray-400 mt-0.5">{SQUARE_PRO_MONTHLY_PRICE_LABEL} / 月（税込）</p>
              )}
              {planType === "trial" && trialDays !== null && (
                <p className="text-xs text-amber-600 mt-0.5">残り {trialDays} 日</p>
              )}
            </div>
            <div className="ml-auto">
              <BillingStatusBadge status={billingStatus} />
            </div>
          </div>

          {/* 詳細情報グリッド */}
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {planType === "pro" && (
              <>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">
                    {billingStatus === "canceled" ? "利用期限" : "次回更新日"}
                  </dt>
                  <dd className="text-xs font-semibold text-gray-700">
                    {fmtDate(billingData?.current_period_end ?? null)}
                  </dd>
                </div>

                {billingStatus === "past_due" && gracePeriodEndsAt && (
                  <div className={`rounded-xl px-3 py-2.5 ${graceExpired ? "bg-red-50" : "bg-amber-50"}`}>
                    <dt className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mb-0.5">
                      猶予期間終了
                    </dt>
                    <dd className={`text-xs font-semibold ${graceExpired ? "text-red-600" : "text-amber-700"}`}>
                      {fmtDate(gracePeriodEndsAt.toISOString())}
                      {!graceExpired && graceDaysLeft !== null && (
                        <span className="ml-1 text-[10px]">（残{graceDaysLeft}日）</span>
                      )}
                    </dd>
                  </div>
                )}

                {billingStatus === "canceled" && billingData?.canceled_at && (
                  <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                    <dt className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">解約日</dt>
                    <dd className="text-xs font-semibold text-gray-700">{fmtDate(billingData.canceled_at)}</dd>
                  </div>
                )}
              </>
            )}

            {planType === "trial" && trialEndsAt && (
              <div className="rounded-xl bg-amber-50 px-3 py-2.5 col-span-2">
                <dt className="text-[10px] font-bold text-amber-500 uppercase tracking-wide mb-0.5">トライアル終了</dt>
                <dd className="text-xs font-semibold text-amber-700">{fmtDate(trialEndsAt.toISOString())}</dd>
              </div>
            )}
          </dl>
        </section>

        {/* ── アクションカード ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-3">
          <h2 className="text-sm font-black text-gray-700">アクション</h2>

          {/* past_due: カード更新案内 */}
          {billingStatus === "past_due" && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
              <p className="text-sm font-bold text-amber-800 mb-1">⚠️ お支払い方法の更新が必要です</p>
              <p className="text-xs text-amber-600 leading-relaxed mb-3">
                {graceExpired
                  ? "猶予期間が終了しました。お支払い方法を更新してProプランを再開してください。"
                  : `${graceDaysLeft ?? 0}日以内にお支払い方法を更新してください。期限を過ぎると機能がロックされます。`}
              </p>
              <a
                href="https://www.paypal.com/jp/smarthelp/article/how-do-i-manage-my-automatic-payments-faq1766"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-lg transition-colors"
              >
                PayPal で支払い方法を更新する →
              </a>
            </div>
          )}

          {/* Pro でも past_due でも canceled でもない（trial / expired） → アップグレード */}
          {(planType === "trial" || planType === "expired") && (
            <button
              onClick={() => void handleUpgrade()}
              disabled={checkoutLoading}
              className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099b3] disabled:opacity-60 text-white font-black text-sm rounded-xl transition-colors shadow-sm"
            >
              {checkoutLoading ? "チェックアウトを準備中..." : "Proプランにアップグレード →"}
            </button>
          )}

          {/* active → 解約ボタン */}
          {planType === "pro" && billingStatus === "active" && (
            <button
              onClick={() => setShowCancel(true)}
              className="w-full py-2.5 text-sm font-semibold border border-red-200 text-red-500 rounded-xl hover:bg-red-50 transition-colors"
            >
              Proプランを解約する
            </button>
          )}

          {/* canceled → 再申し込み案内 */}
          {planType === "pro" && billingStatus === "canceled" && (
            <div className="rounded-xl bg-[#E6F8FC] border border-[#b3e8f4] p-4">
              <p className="text-sm font-bold text-[#007a96] mb-1">再申し込みについて</p>
              <p className="text-xs text-[#00AFCC] leading-relaxed mb-3">
                利用期限後に再度アップグレードすることができます。
              </p>
              <Link
                href="/pricing"
                className="inline-block text-xs font-semibold text-[#00AFCC] underline hover:no-underline"
              >
                料金プランを確認する →
              </Link>
            </div>
          )}

          <Link
            href="/"
            className="block w-full py-2.5 text-center text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← エディターに戻る
          </Link>
        </section>

        {/* ── 支払い履歴 ── */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black text-gray-700">支払い履歴</h2>
            <button
              onClick={() => void fetchBilling()}
              disabled={fetching}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              {fetching ? "更新中…" : "↻ 更新"}
            </button>
          </div>

          {fetching && events.length === 0 ? (
            <p className="text-center py-6 text-gray-400 text-xs">読み込み中…</p>
          ) : events.length === 0 ? (
            <p className="text-center py-6 text-gray-400 text-xs">まだ履歴がありません</p>
          ) : (
            <div className="space-y-0 divide-y divide-gray-50">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 py-3">
                  <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-sm shrink-0">
                    {ev.billing_status === "active"   ? "✓" :
                     ev.billing_status === "past_due" ? "✕" :
                     ev.billing_status === "canceled" ? "⊘" : "○"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-700">
                      <EventTypeLabel type={ev.event_type} />
                    </p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{fmt(ev.processed_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {ev.amount !== null && (
                      <p className="text-xs font-bold text-gray-800">{fmtAmount(ev.amount, ev.currency)}</p>
                    )}
                    {ev.billing_status && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{ev.billing_status}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
