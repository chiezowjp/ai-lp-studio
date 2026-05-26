"use client";

/**
 * /leads — リード管理ページ
 *
 * 機能:
 * - リード一覧表示
 * - ステータス変更（new / contacted / archived）
 * - 詳細ダイアログ
 * - CSV エクスポート
 * - 検索 / フィルタ
 */

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Lead {
  id: string;
  project_id: string;
  project_slug: string | null;
  form_name: string;
  payload: Record<string, unknown>;
  submitted_at: string;
  status: "new" | "contacted" | "archived";
  ip_address: string | null;
  referrer: string | null;
}

interface ApiResponse {
  leads: Lead[];
  total: number;
  page: number;
  pages: number;
}

const STATUS_LABELS: Record<string, string> = {
  new:       "新規",
  contacted: "対応済",
  archived:  "アーカイブ",
};

const STATUS_COLORS: Record<string, string> = {
  new:       "bg-blue-100 text-blue-700",
  contacted: "bg-green-100 text-green-700",
  archived:  "bg-gray-100 text-gray-500",
};

// ─── 詳細モーダル ─────────────────────────────────────────────────────────────

function LeadDetail({
  lead,
  onClose,
  onStatusChange,
}: {
  lead: Lead;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
}) {
  const [status, setStatus] = useState(lead.status);
  const [saving, setSaving] = useState(false);

  const handleStatus = async (newStatus: string) => {
    setSaving(true);
    try {
      await fetch(`/api/leads/${lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus as Lead["status"]);
      onStatusChange(lead.id, newStatus);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.5)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">リード詳細</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 text-sm">✕</button>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* メタ情報 */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="text-gray-400 font-semibold mb-0.5">送信日時</p>
              <p className="text-gray-700">{new Date(lead.submitted_at).toLocaleString("ja-JP")}</p>
            </div>
            <div>
              <p className="text-gray-400 font-semibold mb-0.5">LP スラグ</p>
              <p className="text-gray-700 font-mono">{lead.project_slug ?? "—"}</p>
            </div>
            {lead.referrer && (
              <div className="col-span-2">
                <p className="text-gray-400 font-semibold mb-0.5">リファラー</p>
                <p className="text-gray-700 truncate">{lead.referrer}</p>
              </div>
            )}
          </div>

          {/* フォームデータ */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">送信内容</p>
            <div className="space-y-2">
              {Object.entries(lead.payload).map(([k, v]) => (
                <div key={k} className="bg-gray-50 rounded-lg px-3 py-2">
                  <p className="text-[10px] text-gray-400 font-semibold">{k}</p>
                  <p className="text-sm text-gray-800 mt-0.5">{String(v || "—")}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ステータス変更 */}
          <div>
            <p className="text-xs font-bold text-gray-700 mb-2">ステータス</p>
            <div className="flex gap-2">
              {(["new", "contacted", "archived"] as const).map((s) => (
                <button
                  key={s}
                  disabled={saving || status === s}
                  onClick={() => handleStatus(s)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg border-2 transition-colors disabled:cursor-not-allowed ${
                    status === s
                      ? "border-[#00AFCC] bg-[#E6F8FC] text-[#00AFCC]"
                      : "border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC]"
                  }`}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function LeadsPage() {
  const { user, session } = useAuth();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [exporting, setExporting] = useState(false);

  // ── 未ログインはリダイレクト ──
  useEffect(() => {
    if (user === null) router.push("/");
  }, [user, router]);

  // ── データ取得 ──
  const fetchLeads = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: "50",
      });
      if (q)            params.set("q", q);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/leads?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("取得失敗");
      const data = (await res.json()) as ApiResponse;
      setLeads(data.leads);
      setTotal(data.total);
      setPages(data.pages);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [session, page, q, statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ── ステータス変更 ──
  const handleStatusChange = (id: string, newStatus: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus as Lead["status"] } : l))
    );
  };

  // ── CSV エクスポート ──
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      const res = await fetch(`/api/leads/export?${params}`, {
        headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  // ── ローディング中（ユーザー未確定） ──
  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      {/* 詳細モーダル */}
      {selectedLead && (
        <LeadDetail
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onStatusChange={handleStatusChange}
        />
      )}

      {/* ヘッダー */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-4">
          <button
            onClick={() => router.push("/")}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ← エディター
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-gray-900">📬 リード管理</h1>
          </div>
          <span className="text-xs text-gray-400">{total} 件</span>
          <button
            onClick={handleExport}
            disabled={exporting || total === 0}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {exporting ? "…" : "⬇ CSV"}
          </button>
          <button
            onClick={() => router.push("/my-lps")}
            className="px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            📁 マイLP
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6">
        {/* 検索 / フィルタ */}
        <div className="flex gap-3 mb-5">
          <input
            type="text"
            placeholder="名前・メール・内容で検索…"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-[#00AFCC] bg-white"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-white outline-none focus:border-[#00AFCC]"
          >
            <option value="">全ステータス</option>
            <option value="new">新規</option>
            <option value="contacted">対応済</option>
            <option value="archived">アーカイブ</option>
          </select>
        </div>

        {/* エラー */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* テーブル */}
        {loading ? (
          <div className="flex items-center justify-center h-40 text-gray-400 text-sm gap-2">
            <span className="w-4 h-4 border-2 border-gray-200 border-t-[#00AFCC] rounded-full animate-spin" />
            読み込み中…
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-[#E6F8FC] flex items-center justify-center text-3xl">
              📭
            </div>
            <p className="text-sm text-gray-400">
              {q || statusFilter ? "条件に一致するリードがありません" : "まだリードがありません"}
            </p>
          </div>
        ) : (
          <>
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">送信日時</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">LP</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">名前</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">メール</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400">ステータス</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => {
                    const name  = String(lead.payload.name  ?? lead.payload.お名前 ?? "—");
                    const email = String(lead.payload.email ?? lead.payload.メール ?? lead.payload.メールアドレス ?? "—");
                    return (
                      <tr
                        key={lead.id}
                        className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => setSelectedLead(lead)}
                      >
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                          {new Date(lead.submitted_at).toLocaleString("ja-JP", {
                            month: "2-digit", day: "2-digit",
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500 font-mono max-w-[120px] truncate">
                          {lead.project_slug ?? "—"}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-800">{name}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate">{email}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${STATUS_COLORS[lead.status]}`}>
                            {STATUS_LABELS[lead.status]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className="text-xs text-[#00AFCC] font-semibold">詳細 →</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ページネーション */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  ← 前へ
                </button>
                <span className="text-xs text-gray-500">{page} / {pages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
                >
                  次へ →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
