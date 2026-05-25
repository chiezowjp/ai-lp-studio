"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { usePlan } from "@/lib/plan-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserBilling {
  id: string;
  plan_type: "trial" | "pro" | "expired";
  trial_ends_at: string | null;
  billing_status: string | null;
  current_period_end: string | null;
  canceled_at: string | null;
  square_subscription_id: string | null;
  is_admin: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

function PlanBadge({ plan }: { plan: string }) {
  const styles: Record<string, string> = {
    trial:   "bg-amber-100 text-amber-700",
    pro:     "bg-[#E6F8FC] text-[#00AFCC]",
    expired: "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[plan] ?? "bg-gray-100 text-gray-500"}`}>
      {plan}
    </span>
  );
}

function BillingBadge({ status }: { status: string | null }) {
  if (!status || status === "none") {
    return <span className="text-[10px] text-gray-400">none</span>;
  }
  const styles: Record<string, string> = {
    active:   "bg-green-100 text-green-700",
    past_due: "bg-amber-100 text-amber-700",
    canceled: "bg-red-100 text-red-600",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${styles[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminBillingPage() {
  const { session, loading: authLoading } = useAuth();
  const { isAdmin, loading: planLoading } = usePlan();
  const router = useRouter();

  const [users, setUsers]       = useState<UserBilling[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/billing", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "取得失敗");
      setUsers(await res.json() as UserBilling[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    if (!authLoading && !planLoading && isAdmin) {
      void fetchUsers();
    }
  }, [authLoading, planLoading, isAdmin, fetchUsers]);

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (authLoading || planLoading) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">読み込み中...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-3">
        <p className="text-gray-500">管理者専用ページです</p>
        <button onClick={() => router.push("/")} className="text-sm text-[#00AFCC] underline">
          トップに戻る
        </button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      <header className="bg-[#F7F7F4] border-b border-[#D8D8D2] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-[11px] shrink-0"
          >
            AI
          </button>
          <h1 className="text-[15px] font-black text-gray-900 tracking-[0.15em] flex-1">
            管理 — 課金ステータス
          </h1>
          <button
            onClick={() => void fetchUsers()}
            disabled={fetching}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {fetching ? "更新中…" : "↻ 更新"}
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {(["trial", "pro", "expired"] as const).map((plan) => {
            const count = users.filter((u) => u.plan_type === plan).length;
            return (
              <div key={plan} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
                <p className="text-[11px] text-gray-400 font-semibold uppercase">{plan}</p>
                <p className="text-2xl font-black text-gray-900 mt-0.5">{count}</p>
              </div>
            );
          })}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3">
            <p className="text-[11px] text-gray-400 font-semibold uppercase">Total</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{users.length}</p>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="grid grid-cols-[1fr_80px_90px_120px_120px_120px] text-[11px] font-bold text-gray-400 px-4 py-2.5 bg-gray-50 border-b border-gray-100 uppercase tracking-wide">
            <span>User ID</span>
            <span>Plan</span>
            <span>Billing</span>
            <span>Period End</span>
            <span>Trial Ends</span>
            <span>Canceled At</span>
          </div>

          {fetching && users.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">読み込み中…</div>
          ) : users.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">ユーザーがいません</div>
          ) : (
            users.map((u, i) => (
              <div
                key={u.id}
                className={`grid grid-cols-[1fr_80px_90px_120px_120px_120px] px-4 py-3 items-center text-xs border-b border-gray-50 last:border-0 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/30"}`}
              >
                <span className="font-mono text-gray-500 truncate pr-2" title={u.id}>
                  {u.id.slice(0, 8)}…
                  {u.is_admin && (
                    <span className="ml-1.5 text-[9px] font-bold bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">admin</span>
                  )}
                </span>
                <PlanBadge plan={u.plan_type} />
                <BillingBadge status={u.billing_status} />
                <span className="text-gray-500 text-[11px]">{fmt(u.current_period_end)}</span>
                <span className="text-gray-500 text-[11px]">{fmt(u.trial_ends_at)}</span>
                <span className="text-gray-500 text-[11px]">{fmt(u.canceled_at)}</span>
              </div>
            ))
          )}
        </div>

        <p className="text-xs text-gray-400 mt-4 text-center">
          プラン変更は <button onClick={() => router.push("/admin")} className="underline hover:text-gray-600">管理ページ</button> から行えます
        </p>
      </main>
    </div>
  );
}
