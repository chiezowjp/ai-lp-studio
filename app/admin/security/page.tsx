"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SecurityEvent {
  id: string;
  event_type: string;
  user_id: string | null;
  ip_address: string | null;
  severity: "low" | "medium" | "high" | "critical";
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_type: string | null;
  target_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: string;
}

interface RateLimitHit {
  type: "ip" | "user";
  key: string;
  count: number;
}

interface FormSpam {
  ip: string;
  count: number;
}

interface ExportAbuse {
  userId: string;
  count: number;
}

interface SecurityData {
  securityEvents: SecurityEvent[];
  auditLogs: AuditLog[];
  rateLimitHits: RateLimitHit[];
  formSpam: FormSpam[];
  exportAbuse: ExportAbuse[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("ja-JP", {
    month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

function shortId(id: string | null): string {
  if (!id) return "—";
  return id.slice(0, 8) + "…";
}

const SEVERITY_STYLE: Record<string, string> = {
  low:      "bg-gray-100 text-gray-600",
  medium:   "bg-amber-100 text-amber-700",
  high:     "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700 font-bold",
};

const EVENT_TYPE_LABEL: Record<string, string> = {
  rate_limit_exceeded:   "レートリミット超過",
  mass_generation:       "大量生成",
  export_spam:           "エクスポートスパム",
  form_spam:             "フォームスパム",
  webhook_abuse:         "Webhook乱用",
  consecutive_auth_fail: "認証失敗連発",
  suspicious_ip:         "不審なIP",
  input_size_exceeded:   "入力サイズ超過",
  ownership_violation:   "所有権違反",
};

const ACTION_LABEL: Record<string, string> = {
  publish:             "公開",
  unpublish:           "非公開",
  delete_project:      "プロジェクト削除",
  lead_export:         "リードCSVエクスポート",
  lead_status_update:  "リードステータス更新",
  billing_upgrade:     "プランアップグレード",
  billing_cancel:      "プランキャンセル",
  form_submit:         "フォーム送信",
  form_config_update:  "フォーム設定変更",
  project_create:      "プロジェクト作成",
  project_update:      "プロジェクト更新",
};

// ─── Sub Components ───────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700 mb-3">{title}</h2>
      {children}
    </div>
  );
}

function EmptyRow({ cols = 6 }: { cols?: number }) {
  return (
    <tr>
      <td colSpan={cols} className="py-6 text-center text-xs text-gray-400">
        データなし
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SecurityPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<SecurityData | null>(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"events" | "audit" | "rate" | "spam">("events");

  const fetchData = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/security", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 403) {
        setError("管理者権限が必要です。");
        return;
      }
      if (!res.ok) throw new Error("データ取得に失敗しました");
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  if (loading || !user) return null;

  const tabs: { key: typeof activeTab; label: string; count?: number }[] = [
    { key: "events", label: "🚨 セキュリティイベント", count: data?.securityEvents.length },
    { key: "audit",  label: "📋 監査ログ",             count: data?.auditLogs.length },
    { key: "rate",   label: "⚡ レートリミット",        count: data?.rateLimitHits.length },
    { key: "spam",   label: "🛡 スパム・乱用",          count: (data?.formSpam.length ?? 0) + (data?.exportAbuse.length ?? 0) },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-sm">← ホーム</button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-semibold text-gray-800">セキュリティ監視</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={fetching}
          className="text-xs bg-[#00AFCC] text-white px-3 py-1.5 rounded-lg hover:bg-[#0099b5] disabled:opacity-50"
        >
          {fetching ? "読み込み中…" : "🔄 更新"}
        </button>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-5">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {error}
          </div>
        )}

        {!data && !fetching && !error && (
          <div className="text-center py-20 text-gray-400 text-sm">データを読み込み中…</div>
        )}

        {data && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: "セキュリティイベント (48h)", value: data.securityEvents.length, color: "text-red-600" },
                { label: "監査ログ (24h)",             value: data.auditLogs.length,      color: "text-blue-600" },
                { label: "レートリミット超過 (24h)",   value: data.rateLimitHits.reduce((s, r) => s + r.count, 0), color: "text-orange-600" },
                { label: "フォームスパム (24h)",       value: data.formSpam.reduce((s, f) => s + f.count, 0),      color: "text-amber-600" },
              ].map((card) => (
                <div key={card.label} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  <p className="text-xs text-gray-500 mb-1">{card.label}</p>
                  <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
                </div>
              ))}
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all ${
                    activeTab === tab.key
                      ? "bg-white text-gray-800 shadow-sm font-medium"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className="ml-1.5 bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5 text-[10px]">
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Security Events */}
            {activeTab === "events" && (
              <SectionCard title="セキュリティイベント（直近48時間）">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-3">時刻</th>
                        <th className="pb-2 pr-3">種別</th>
                        <th className="pb-2 pr-3">重要度</th>
                        <th className="pb-2 pr-3">ユーザーID</th>
                        <th className="pb-2 pr-3">IP</th>
                        <th className="pb-2">詳細</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.securityEvents.length === 0 ? (
                        <EmptyRow />
                      ) : (
                        data.securityEvents.map((ev) => (
                          <tr key={ev.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{fmt(ev.created_at)}</td>
                            <td className="py-2 pr-3 font-medium text-gray-700 whitespace-nowrap">
                              {EVENT_TYPE_LABEL[ev.event_type] ?? ev.event_type}
                            </td>
                            <td className="py-2 pr-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${SEVERITY_STYLE[ev.severity] ?? ""}`}>
                                {ev.severity}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-400">{shortId(ev.user_id)}</td>
                            <td className="py-2 pr-3 font-mono text-gray-500">{ev.ip_address ?? "—"}</td>
                            <td className="py-2 text-gray-400 max-w-xs truncate">
                              {Object.entries(ev.metadata).map(([k, v]) => `${k}:${v}`).join(" ")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* Tab: Audit Logs */}
            {activeTab === "audit" && (
              <SectionCard title="監査ログ（直近24時間）">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-3">時刻</th>
                        <th className="pb-2 pr-3">アクション</th>
                        <th className="pb-2 pr-3">ユーザーID</th>
                        <th className="pb-2 pr-3">対象</th>
                        <th className="pb-2 pr-3">IP</th>
                        <th className="pb-2">詳細</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.auditLogs.length === 0 ? (
                        <EmptyRow />
                      ) : (
                        data.auditLogs.map((log) => (
                          <tr key={log.id} className="hover:bg-gray-50">
                            <td className="py-2 pr-3 text-gray-500 whitespace-nowrap">{fmt(log.created_at)}</td>
                            <td className="py-2 pr-3 font-medium text-gray-700 whitespace-nowrap">
                              {ACTION_LABEL[log.action] ?? log.action}
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-400">{shortId(log.user_id)}</td>
                            <td className="py-2 pr-3 text-gray-500">
                              {log.target_type && <span className="text-gray-400">{log.target_type}/</span>}
                              {shortId(log.target_id)}
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-500">{log.ip_address ?? "—"}</td>
                            <td className="py-2 text-gray-400 max-w-xs truncate">
                              {Object.entries(log.metadata).map(([k, v]) => `${k}:${JSON.stringify(v)}`).join(" ")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* Tab: Rate Limits */}
            {activeTab === "rate" && (
              <SectionCard title="レートリミット超過 — 上位 IP・ユーザー（直近24時間）">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 border-b border-gray-100">
                        <th className="pb-2 pr-3">種別</th>
                        <th className="pb-2 pr-3">IP / ユーザーID</th>
                        <th className="pb-2">超過回数</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {data.rateLimitHits.length === 0 ? (
                        <EmptyRow cols={3} />
                      ) : (
                        data.rateLimitHits.map((hit, i) => (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="py-2 pr-3">
                              <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] ${hit.type === "ip" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                                {hit.type === "ip" ? "IP" : "USER"}
                              </span>
                            </td>
                            <td className="py-2 pr-3 font-mono text-gray-600">{hit.key}</td>
                            <td className="py-2">
                              <span className={`font-bold ${hit.count >= 10 ? "text-red-600" : hit.count >= 5 ? "text-orange-600" : "text-gray-700"}`}>
                                {hit.count}回
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            )}

            {/* Tab: Spam & Abuse */}
            {activeTab === "spam" && (
              <div className="space-y-4">
                <SectionCard title="フォームスパム — 上位 IP（直近24時間）">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-2 pr-3">IP</th>
                          <th className="pb-2">スパム送信回数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.formSpam.length === 0 ? (
                          <EmptyRow cols={2} />
                        ) : (
                          data.formSpam.map((s, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="py-2 pr-3 font-mono text-gray-600">{s.ip}</td>
                              <td className="py-2 font-bold text-red-600">{s.count}回</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>

                <SectionCard title="エクスポート多発ユーザー（直近24時間）">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-gray-500 border-b border-gray-100">
                          <th className="pb-2 pr-3">ユーザーID</th>
                          <th className="pb-2">エクスポート回数</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.exportAbuse.length === 0 ? (
                          <EmptyRow cols={2} />
                        ) : (
                          data.exportAbuse.map((e, i) => (
                            <tr key={i} className="hover:bg-gray-50">
                              <td className="py-2 pr-3 font-mono text-gray-600">{e.userId}</td>
                              <td className="py-2 font-bold text-orange-600">{e.count}回</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </SectionCard>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
