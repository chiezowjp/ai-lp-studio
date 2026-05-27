"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { usePlan } from "@/lib/plan-context";
import { PLAN_LIMITS, PLAN_LABEL, trialDaysLeft } from "@/lib/plans";
import type { DbProjectSummary } from "@/lib/supabase";
import Tooltip from "@/components/Tooltip";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MyLPsPage() {
  const { user, session, loading: authLoading, signInWithGoogle } = useAuth();
  const { planType, trialEndsAt } = usePlan();
  const days = trialDaysLeft(trialEndsAt);
  const router = useRouter();

  const [projects, setProjects]   = useState<DbProjectSummary[]>([]);
  const [fetching, setFetching]   = useState(false);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  // ── 一覧取得 ──────────────────────────────────────────────────────────────

  const fetchProjects = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/projects", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "取得失敗");
      setProjects(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
    } finally {
      setFetching(false);
    }
  }, [session]);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  // ── 削除 ──────────────────────────────────────────────────────────────────

  const handleDelete = async (id: string, title: string) => {
    if (!session) return;
    if (!confirm(`「${title}」を削除しますか？この操作は取り消せません。`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "削除失敗");
      setProjects((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      alert(e instanceof Error ? e.message : "削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  // ── 複製 ──────────────────────────────────────────────────────────────────

  const handleDuplicate = async (project: DbProjectSummary) => {
    if (!session) return;
    // 保存数上限チェック（サーバー側でも確認するがUXのため早期リターン）
    if (planType) {
      const maxProjects = PLAN_LIMITS[planType].maxProjects;
      if (projects.length >= maxProjects) {
        alert(`${PLAN_LABEL[planType]}プランの保存上限（${maxProjects}件）に達しています。\nProプランにアップグレードすると最大${PLAN_LIMITS.pro.maxProjects}件保存できます。`);
        return;
      }
    }
    setDuplicating(project.id);
    try {
      // サーバー側で SELECT → INSERT するため html/css/json をクライアントで持つ必要なし
      const res = await fetch(`/api/projects/${project.id}/duplicate`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "複製失敗");
      const created: DbProjectSummary = await res.json();
      setProjects((prev) => [created, ...prev]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "複製に失敗しました");
    } finally {
      setDuplicating(null);
    }
  };

  // ── タイトル編集 ─────────────────────────────────────────────────────────

  const handleRenameStart = (p: DbProjectSummary) => {
    setEditingId(p.id);
    setEditingTitle(p.title);
  };

  const handleRenameSubmit = async (id: string) => {
    if (!session) return;
    const title = editingTitle.trim();
    if (!title) { setEditingId(null); return; }
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "更新失敗");
      setProjects((prev) => prev.map((p) => p.id === id ? { ...p, title } : p));
    } catch (e) {
      alert(e instanceof Error ? e.message : "名前の変更に失敗しました");
    } finally {
      setEditingId(null);
    }
  };

  // ── 編集（エディターへ移動）──────────────────────────────────────────────

  const handleEdit = (id: string) => {
    router.push(`/?p=${id}`);
  };

  // ── 新規作成 ──────────────────────────────────────────────────────────────

  const handleNew = () => { window.location.href = "/"; };

  // ── Render ────────────────────────────────────────────────────────────────

  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        読み込み中...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-6 bg-[#F5F5F2]">
        <div className="w-12 h-12 rounded-2xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-[13px]">
          AI
        </div>
        <h1 className="text-xl font-bold text-gray-800">AI LP STUDIO</h1>
        <p className="text-sm text-gray-500">マイLPを表示するにはログインしてください</p>
        <button
          onClick={signInWithGoogle}
          className="flex items-center gap-2.5 px-5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Google でログイン
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F5F2]">
      {/* Header */}
      <header className="bg-[#F7F7F4] border-b border-[#D8D8D2] sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="w-9 h-9 rounded-xl bg-[#00AFCC] flex items-center justify-center text-white font-black text-[11px] shrink-0"
          >
            AI
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <h1 className="text-[15px] font-black text-gray-900 tracking-[0.15em]">AI LP STUDIO</h1>
            {planType && (
              <Link
                href="/pricing"
                className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-opacity hover:opacity-80
                  ${planType === "trial" ? "bg-amber-100 text-amber-700 border-amber-200" : ""}
                  ${planType === "pro"   ? "bg-[#E6F8FC] text-[#00AFCC] border-[#b3e8f4]" : ""}
                  ${planType === "expired" ? "bg-red-100 text-red-600 border-red-200" : ""}`}
              >
                <span>{planType === "trial" ? "トライアル" : planType === "pro" ? "Pro" : "期限切れ"}</span>
                {planType === "trial" && days !== null && (
                  <span className="opacity-70">{days === 0 ? "最終日" : `残${days}日`}</span>
                )}
              </Link>
            )}
          </div>
          <span className="text-xs text-gray-500 hidden sm:block shrink-0">
            {user.email}
          </span>
          <button
            onClick={handleNew}
            className="px-3 py-1.5 text-xs font-semibold bg-[#00AFCC] text-white rounded-lg hover:bg-[#0099b3] transition-colors shrink-0"
          >
            ＋ 新規作成
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* トライアル終了バナー */}
        {planType === "expired" && (
          <div className="mb-6 rounded-2xl bg-red-50 border border-red-200 px-5 py-4 flex items-center gap-3">
            <span className="text-xl shrink-0">🔒</span>
            <div className="flex-1">
              <p className="text-sm font-black text-red-800">トライアル期間が終了しました</p>
              <p className="text-xs text-red-600 mt-0.5">編集・エクスポートはProプランでご利用いただけます。LPのプレビューはこちらから確認できます。</p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-black rounded-xl transition-colors"
            >
              料金を見る
            </Link>
          </div>
        )}

        {/* トライアル残り日数バナー（残り2日以内） */}
        {planType === "trial" && days !== null && days <= 2 && (
          <div className={`mb-6 rounded-2xl px-5 py-4 flex items-center gap-3 border
            ${days <= 1 ? "bg-red-50 border-red-200" : "bg-amber-50 border-amber-200"}`}>
            <span className="text-xl shrink-0">⏱</span>
            <div className="flex-1">
              <p className={`text-sm font-black ${days <= 1 ? "text-red-800" : "text-amber-800"}`}>
                {days === 0 ? "本日でトライアル終了です" : `トライアル残り ${days} 日`}
              </p>
              <p className={`text-xs mt-0.5 ${days <= 1 ? "text-red-600" : "text-amber-600"}`}>
                期間終了後は編集・エクスポートがロックされます。
              </p>
            </div>
            <Link
              href="/pricing"
              className="shrink-0 px-4 py-2 bg-[#00AFCC] hover:bg-[#0099b3] text-white text-xs font-black rounded-xl transition-colors"
            >
              Proにする
            </Link>
          </div>
        )}

        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">マイLP</h2>
            {planType && (
              <span className="text-xs text-gray-400">
                {projects.length} / {PLAN_LIMITS[planType].maxProjects}件
              </span>
            )}
          </div>
          <button
            onClick={fetchProjects}
            disabled={fetching}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            {fetching ? "更新中…" : "↻ 更新"}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4">
            {error}
          </div>
        )}

        {fetching && projects.length === 0 ? (
          <div className="text-center py-20 text-gray-400 text-sm">読み込み中…</div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm mb-4">まだLPが保存されていません</p>
            <button
              onClick={handleNew}
              className="px-5 py-2.5 bg-[#00AFCC] text-white text-sm font-semibold rounded-xl hover:bg-[#0099b3] transition-colors"
            >
              最初のLPを作る
            </button>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  {editingId === p.id ? (
                    <input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={() => handleRenameSubmit(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRenameSubmit(p.id);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="w-full text-sm font-bold text-gray-900 border-b border-[#00AFCC] outline-none bg-transparent pb-0.5"
                    />
                  ) : (
                    <Tooltip text="クリックで名前を変更" position="top">
                      <p
                        className="text-sm font-bold text-gray-900 truncate cursor-pointer hover:text-[#00AFCC] transition-colors"
                        onClick={() => handleRenameStart(p)}
                      >
                        {p.title}
                      </p>
                    </Tooltip>
                  )}
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    更新: {fmt(p.updated_at)}
                    <span className="mx-1.5 text-gray-200">|</span>
                    作成: {fmt(p.created_at)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <Tooltip text="エディターで開いて編集する" position="top">
                    <button
                      onClick={() => handleEdit(p.id)}
                      className="px-3 py-1.5 text-[11px] font-semibold bg-[#00AFCC] text-white rounded-lg hover:bg-[#0099b3] transition-colors"
                    >
                      編集
                    </button>
                  </Tooltip>
                  {p.is_published && (
                    <Tooltip text="アクセス数・CV率などを確認" position="top">
                      <Link
                        href={`/analytics/${p.id}`}
                        className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        📊 分析
                      </Link>
                    </Tooltip>
                  )}
                  <Tooltip text="このLPのコピーを作成する" position="top">
                    <button
                      onClick={() => handleDuplicate(p)}
                      disabled={duplicating === p.id}
                      className="px-3 py-1.5 text-[11px] font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                      {duplicating === p.id ? "…" : "複製"}
                    </button>
                  </Tooltip>
                  <Tooltip text="このLPを完全に削除する（取り消し不可）" position="top">
                    <button
                      onClick={() => handleDelete(p.id, p.title)}
                      disabled={deleting === p.id}
                      className="px-3 py-1.5 text-[11px] font-semibold border border-red-200 text-red-500 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                    >
                      {deleting === p.id ? "…" : "削除"}
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
