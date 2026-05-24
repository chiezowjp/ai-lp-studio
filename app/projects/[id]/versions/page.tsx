"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";

interface Version {
  id: string;
  project_id: string;
  trigger: "publish" | "rollback" | "manual" | "ai_improve" | "auto";
  note: string | null;
  created_at: string;
  title?: string;
}

const TRIGGER_LABEL: Record<string, string> = {
  publish:    "🚀 公開",
  rollback:   "⏪ Rollback",
  manual:     "💾 手動保存",
  ai_improve: "🤖 AI改善",
  auto:       "⚡ 自動",
};

const TRIGGER_COLOR: Record<string, string> = {
  publish:    "bg-green-100 text-green-700",
  rollback:   "bg-orange-100 text-orange-700",
  manual:     "bg-blue-100 text-blue-700",
  ai_improve: "bg-purple-100 text-purple-700",
  auto:       "bg-gray-100 text-gray-600",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleString("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function VersionsPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const projectId = params.id;

  const [versions, setVersions] = useState<Version[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [saveNote, setSaveNote] = useState("");
  const [saving, setSaving]     = useState(false);

  const fetchVersions = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.status === 403) {
        const j = await res.json() as { error: string };
        setError(j.error);
        return;
      }
      if (!res.ok) throw new Error("取得に失敗しました");
      setVersions(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setFetching(false);
    }
  }, [session, projectId]);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (session) fetchVersions();
  }, [session, fetchVersions]);

  const saveManual = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trigger: "manual", note: saveNote || null }),
      });
      if (!res.ok) {
        const j = await res.json() as { error: string };
        setError(j.error);
        return;
      }
      setSaveNote("");
      await fetchVersions();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setSaving(false);
    }
  };

  const restore = async (versionId: string) => {
    if (!session) return;
    if (!confirm("このバージョンに戻しますか？現在の状態は Rollback 前スナップショットとして保存されます。")) return;
    setRestoring(versionId);
    try {
      const res = await fetch(`/api/projects/${projectId}/versions/${versionId}/restore`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) {
        const j = await res.json() as { error: string };
        setError(j.error);
        return;
      }
      alert("✅ Rollback が完了しました。エディターを再読み込みしてください。");
      router.push("/");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setRestoring(null);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-sm">← ホーム</button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-semibold text-gray-800">Version 履歴</h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm">
            {error}
            {error.includes("Pro") && (
              <button onClick={() => router.push("/pricing")} className="ml-3 underline text-red-600">アップグレード</button>
            )}
          </div>
        )}

        {/* 手動保存 */}
        <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
          <p className="text-sm font-semibold text-gray-700 mb-3">💾 現在の状態をスナップショット保存</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveNote}
              onChange={(e) => setSaveNote(e.target.value)}
              placeholder="メモ（任意）"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            />
            <button
              onClick={saveManual}
              disabled={saving}
              className="text-sm bg-[#00AFCC] text-white px-4 py-1.5 rounded-lg hover:bg-[#0099b5] disabled:opacity-50"
            >
              {saving ? "保存中…" : "保存"}
            </button>
          </div>
        </div>

        {/* バージョン一覧 */}
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">履歴（最大50件）</p>
          </div>

          {fetching && (
            <p className="text-center py-8 text-gray-400 text-sm">読み込み中…</p>
          )}

          {!fetching && versions.length === 0 && (
            <p className="text-center py-8 text-gray-400 text-sm">まだバージョン履歴がありません</p>
          )}

          {versions.map((v, i) => (
            <div
              key={v.id}
              className={`flex items-center justify-between px-5 py-4 ${i !== versions.length - 1 ? "border-b border-gray-50" : ""} hover:bg-gray-50`}
            >
              <div className="flex items-start gap-3 min-w-0">
                <span className={`mt-0.5 shrink-0 text-[10px] px-2 py-0.5 rounded-full font-medium ${TRIGGER_COLOR[v.trigger] ?? "bg-gray-100 text-gray-600"}`}>
                  {TRIGGER_LABEL[v.trigger] ?? v.trigger}
                </span>
                <div className="min-w-0">
                  <p className="text-sm text-gray-700 truncate">{v.note ?? "（メモなし）"}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{fmt(v.created_at)}</p>
                </div>
              </div>
              <button
                onClick={() => restore(v.id)}
                disabled={restoring === v.id}
                className="shrink-0 ml-4 text-xs border border-gray-300 text-gray-600 px-3 py-1.5 rounded-lg hover:border-orange-400 hover:text-orange-600 disabled:opacity-50"
              >
                {restoring === v.id ? "処理中…" : "⏪ Rollback"}
              </button>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
