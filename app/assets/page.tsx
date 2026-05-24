"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import type { DbAsset } from "@/lib/supabase";

const USAGE_LABELS: Record<string, string> = {
  general:  "🖼 LP画像",
  og_image: "📸 OGP画像",
  favicon:  "🏷 Favicon",
  lp_image: "🖼 LP画像",
};

const ACCEPT = "image/jpeg,image/png,image/gif,image/webp,image/svg+xml";
const MAX_MB = 10;

function FileSize({ bytes }: { bytes: number }) {
  if (bytes < 1024)       return <span>{bytes}B</span>;
  if (bytes < 1024 * 1024) return <span>{(bytes / 1024).toFixed(1)}KB</span>;
  return <span>{(bytes / 1024 / 1024).toFixed(1)}MB</span>;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { month: "2-digit", day: "2-digit" });
}

export default function AssetsPage() {
  const { user, session, loading } = useAuth();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [assets, setAssets]       = useState<DbAsset[]>([]);
  const [fetching, setFetching]   = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [success, setSuccess]     = useState<string | null>(null);
  const [usageType, setUsageType] = useState("general");
  const [copied, setCopied]       = useState<string | null>(null);
  const [deleting, setDeleting]   = useState<string | null>(null);
  const [filterType, setFilterType] = useState("");

  const fetchAssets = useCallback(async () => {
    if (!session) return;
    setFetching(true);
    try {
      const params = new URLSearchParams();
      if (filterType) params.set("usage_type", filterType);
      const res = await fetch(`/api/assets?${params}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) throw new Error("取得に失敗しました");
      setAssets(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setFetching(false);
    }
  }, [session, filterType]);

  useEffect(() => {
    if (!loading && !user) router.push("/");
  }, [loading, user, router]);

  useEffect(() => {
    if (session) fetchAssets();
  }, [session, fetchAssets]);

  const upload = async (file: File) => {
    if (!session) return;
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`ファイルサイズが ${MAX_MB}MB を超えています`);
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("usage_type", usageType);

      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      });
      const j = await res.json() as DbAsset & { error?: string; code?: string };
      if (!res.ok) {
        if (j.code === "ASSET_LIMIT") {
          setError("アセットの上限に達しました。Pro プランにアップグレードしてください。");
        } else {
          setError(j.error ?? "アップロードに失敗しました");
        }
        return;
      }
      setSuccess("アップロードが完了しました ✅");
      await fetchAssets();
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラー");
    } finally {
      setUploading(false);
    }
  };

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  };

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(url);
      setTimeout(() => setCopied(null), 2000);
    });
  };

  const deleteAsset = async (id: string) => {
    if (!session || !confirm("このアセットを削除しますか？")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/assets/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setError("削除に失敗しました"); return; }
      setAssets((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError("削除に失敗しました");
    } finally {
      setDeleting(null);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/")} className="text-gray-400 hover:text-gray-600 text-sm">← ホーム</button>
          <span className="text-gray-300">/</span>
          <h1 className="text-base font-semibold text-gray-800">Asset Library</h1>
        </div>
        <span className="text-xs text-gray-400">{assets.length} 件</span>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-5">
        {/* エラー / 成功 */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700 text-sm flex justify-between">
            {error}
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600 ml-2">✕</button>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-green-700 text-sm flex justify-between">
            {success}
            <button onClick={() => setSuccess(null)} className="text-green-400">✕</button>
          </div>
        )}

        {/* アップロードエリア */}
        <div
          className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-[#00AFCC] transition-colors cursor-pointer"
          onDrop={onDrop}
          onDragOver={(e) => e.preventDefault()}
          onClick={() => fileInputRef.current?.click()}
        >
          <input ref={fileInputRef} type="file" accept={ACCEPT} onChange={onFileChange} className="hidden" />
          <p className="text-2xl mb-2">{uploading ? "⏳" : "📁"}</p>
          <p className="text-sm font-medium text-gray-700">
            {uploading ? "アップロード中…" : "クリックまたはドラッグでアップロード"}
          </p>
          <p className="text-xs text-gray-400 mt-1">JPEG / PNG / GIF / WebP / SVG · 最大 {MAX_MB}MB</p>

          {/* 用途選択 */}
          <div className="mt-4 flex justify-center" onClick={(e) => e.stopPropagation()}>
            <select
              value={usageType}
              onChange={(e) => setUsageType(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5"
            >
              <option value="general">LP画像（汎用）</option>
              <option value="og_image">OGP画像</option>
              <option value="favicon">Favicon</option>
              <option value="lp_image">LP内画像</option>
            </select>
          </div>
        </div>

        {/* フィルター */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">絞り込み：</span>
          {["", "general", "og_image", "favicon", "lp_image"].map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`text-xs px-3 py-1 rounded-full border transition-all ${
                filterType === t
                  ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                  : "border-gray-200 text-gray-600 hover:border-gray-400"
              }`}
            >
              {t === "" ? "すべて" : USAGE_LABELS[t] ?? t}
            </button>
          ))}
        </div>

        {/* 一覧グリッド */}
        {fetching ? (
          <p className="text-center py-8 text-gray-400 text-sm">読み込み中…</p>
        ) : assets.length === 0 ? (
          <div className="text-center py-16 text-gray-400 text-sm">
            <p className="text-3xl mb-2">🖼</p>
            <p>まだアセットがありません</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {assets.map((asset) => (
              <div
                key={asset.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm group"
              >
                {/* サムネイル */}
                <div className="relative aspect-square bg-gray-50 overflow-hidden">
                  {asset.mime_type === "image/svg+xml" ? (
                    // SVG はそのまま表示（XSS リスクなし — 自分のファイルのみ）
                    <img src={asset.url} alt={asset.file_name} className="w-full h-full object-contain p-2" />
                  ) : (
                    <img
                      src={asset.url}
                      alt={asset.file_name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                  {/* オーバーレイ */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => copyUrl(asset.url)}
                      className="text-white text-xs bg-white/20 hover:bg-white/40 px-2 py-1 rounded-lg"
                      title="URLをコピー"
                    >
                      {copied === asset.url ? "✅" : "📋"}
                    </button>
                    <button
                      onClick={() => deleteAsset(asset.id)}
                      disabled={deleting === asset.id}
                      className="text-white text-xs bg-red-500/60 hover:bg-red-500/80 px-2 py-1 rounded-lg"
                      title="削除"
                    >
                      {deleting === asset.id ? "…" : "🗑"}
                    </button>
                  </div>
                </div>

                {/* メタ情報 */}
                <div className="px-2 py-1.5">
                  <p className="text-[10px] text-gray-600 truncate" title={asset.file_name}>
                    {asset.file_name}
                  </p>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[9px] text-gray-400">
                      <FileSize bytes={asset.file_size} />
                    </span>
                    <span className="text-[9px] text-gray-400">{fmt(asset.created_at)}</span>
                  </div>
                  <p className="text-[9px] text-[#00AFCC] mt-0.5">
                    {USAGE_LABELS[asset.usage_type ?? "general"] ?? asset.usage_type}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
