"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { AnalyticsSummary } from "@/lib/supabase";

// ─── ミニバーチャート（CSS のみ） ─────────────────────────────────────────────

function BarChart({
  data,
  label,
  color = "bg-[#00AFCC]",
}: {
  data: { label: string; value: number }[];
  label: string;
  color?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{label}</p>
      <div className="flex items-end gap-1 h-24">
        {data.map((d, i) => (
          <div key={i} className="flex flex-col items-center gap-0.5 flex-1 min-w-0">
            <div
              className={`w-full rounded-t ${color} transition-all`}
              style={{ height: `${Math.round((d.value / max) * 80)}px`, minHeight: d.value > 0 ? "2px" : "0" }}
              title={`${d.label}: ${d.value}`}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub, color = "text-gray-800" }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function pct(rate: number) {
  return `${(rate * 100).toFixed(1)}%`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = params.projectId;

  const [data, setData]     = useState<AnalyticsSummary | null>(null);
  const [days, setDays]     = useState(30);
  const [fetching, setFetching] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics/${projectId}?days=${days}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 403) {
        const j = await res.json() as { error: string; code?: string };
        if (j.code === "PLAN_LIMIT") {
          setError("Analytics は Pro プランでご利用いただけます。");
        } else {
          setError(j.error);
        }
        return;
      }
      if (!res.ok) throw new Error("データ取得に失敗しました");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setFetching(false);
    }
  }, [session, projectId, days]);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  if (loading || !user) return null;

  // 日別チャート用データ（直近 days 日を全て埋める）
  const dailyPvData = (data?.dailySeries ?? []).slice(-30).map((d) => ({
    label: d.date,
    value: d.pageViews,
  }));
  const dailyCtaData = (data?.dailySeries ?? []).slice(-30).map((d) => ({
    label: d.date,
    value: d.ctaClicks,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-sm">← ホーム</button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-semibold text-gray-800">Analytics</h1>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1.5"
          >
            <option value={7}>直近7日</option>
            <option value={30}>直近30日</option>
            <option value={90}>直近90日</option>
          </select>
          <button
            onClick={fetchData}
            disabled={fetching}
            className="text-xs bg-[#00AFCC] text-white px-3 py-1.5 rounded-lg hover:bg-[#0099b5] disabled:opacity-50"
          >
            {fetching ? "読み込み中…" : "🔄 更新"}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center">
            <p className="text-amber-800 text-sm font-medium">{error}</p>
            {error.includes("Pro") && (
              <button
                onClick={() => router.push("/pricing")}
                className="mt-3 text-xs bg-[#00AFCC] text-white px-4 py-2 rounded-lg"
              >
                Pro プランへアップグレード
              </button>
            )}
          </div>
        )}

        {!data && !fetching && !error && (
          <div className="text-center py-20 text-gray-400 text-sm">データを読み込み中…</div>
        )}

        {data && (
          <>
            {/* KPI カード */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <MetricCard label="ページビュー" value={data.totalPageViews.toLocaleString()} color="text-[#00AFCC]" />
              <MetricCard label="ユニーク訪問者" value={data.uniqueVisitors.toLocaleString()} color="text-blue-600" />
              <MetricCard
                label="CTAクリック率"
                value={pct(data.ctaClickRate)}
                sub={`${Math.round(data.ctaClickRate * data.totalPageViews)}件`}
                color={data.ctaClickRate >= 0.05 ? "text-green-600" : "text-orange-500"}
              />
              <MetricCard
                label="フォーム到達率"
                value={pct(data.formOpenRate)}
                color={data.formOpenRate >= 0.1 ? "text-green-600" : "text-orange-500"}
              />
              <MetricCard
                label="フォーム送信率"
                value={pct(data.formSubmitRate)}
                sub="CVR"
                color={data.formSubmitRate >= 0.03 ? "text-green-600" : "text-red-500"}
              />
              <MetricCard
                label="直帰率推定"
                value={pct(1 - Math.min(data.ctaClickRate + data.formOpenRate, 1))}
                color="text-gray-600"
              />
            </div>

            {/* 日別チャート */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                {dailyPvData.length > 0 ? (
                  <BarChart data={dailyPvData} label={`日別ページビュー（直近${days}日）`} color="bg-[#00AFCC]" />
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">データなし</p>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                {dailyCtaData.length > 0 ? (
                  <BarChart data={dailyCtaData} label={`日別CTAクリック（直近${days}日）`} color="bg-green-400" />
                ) : (
                  <p className="text-xs text-gray-400 text-center py-8">データなし</p>
                )}
              </div>
            </div>

            {/* スクロール深度 + デバイス */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* スクロール深度 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-700 mb-3">スクロール到達率</p>
                <div className="space-y-2">
                  {data.scrollDepths.map((d) => {
                    const pv = data.totalPageViews;
                    const rate = pv > 0 ? d.count / pv : 0;
                    return (
                      <div key={d.depth} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 w-10">{d.depth}%</span>
                        <div className="flex-1 bg-gray-100 rounded-full h-2">
                          <div
                            className="bg-[#00AFCC] h-2 rounded-full"
                            style={{ width: `${Math.round(rate * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 w-16 text-right">{d.count}件 ({pct(rate)})</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* デバイス比率 */}
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-700 mb-3">デバイス比率</p>
                {data.deviceBreakdown.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">データなし</p>
                ) : (
                  <div className="space-y-2">
                    {data.deviceBreakdown.map((d) => {
                      const total = data.deviceBreakdown.reduce((s, x) => s + x.count, 0);
                      const rate  = total > 0 ? d.count / total : 0;
                      const label: Record<string, string> = { desktop: "💻 PC", mobile: "📱 スマホ", tablet: "📋 タブレット", unknown: "❓ 不明" };
                      return (
                        <div key={d.device} className="flex items-center gap-2">
                          <span className="text-xs text-gray-600 w-24">{label[d.device] ?? d.device}</span>
                          <div className="flex-1 bg-gray-100 rounded-full h-2">
                            <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${Math.round(rate * 100)}%` }} />
                          </div>
                          <span className="text-xs text-gray-500 w-16 text-right">{pct(rate)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* 上位リファラー */}
            {data.topReferrers.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                <p className="text-xs font-semibold text-gray-700 mb-3">流入元（上位10）</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-4">リファラー</th>
                        <th className="pb-2">訪問数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.topReferrers.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="py-1.5 pr-4 text-gray-700">{r.referrer}</td>
                          <td className="py-1.5 font-medium text-gray-800">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* AI 改善提案リンク — TODO: 未実装のため一時非表示 */}
            {/* <div className="bg-gradient-to-r from-[#00AFCC]/10 to-blue-50 border border-[#00AFCC]/30 rounded-xl p-5 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-800">🤖 AI CV 改善提案</p>
                <p className="text-xs text-gray-500 mt-0.5">この Analytics データをもとに AI が改善提案を生成します</p>
              </div>
              <button
                onClick={() => router.push(`/?p=${projectId}&ai=improve`)}
                className="text-xs bg-[#00AFCC] text-white px-4 py-2 rounded-lg hover:bg-[#0099b5] whitespace-nowrap"
              >
                改善提案を見る →
              </button>
            </div> */}
          </>
        )}
      </main>
    </div>
  );
}
