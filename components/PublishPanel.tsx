"use client";

import { useState, useEffect, useCallback } from "react";
import { usePlan } from "@/lib/plan-context";
import { PLAN_LIMITS } from "@/lib/plans";
import type { Session } from "@supabase/supabase-js";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PublishSettings {
  slug: string | null;
  is_published: boolean;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  og_image: string | null;
  favicon_url: string | null;
  custom_css: string | null;
  custom_head_html: string | null;
  noindex: boolean;
  meta_pixel_id: string | null;
  ga4_id: string | null;
  gtm_id: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** クラウド保存済みプロジェクトの ID。null のとき「先に保存が必要」を表示 */
  projectId: string | null;
  /** エディター上のタイトル（SEO title のデフォルト値として使用） */
  projectTitle: string;
  session: Session | null;
  /** 公開状態変化時に親へ通知 */
  onPublishChange?: (published: boolean, slug: string | null) => void;
  /**
   * 画像・ビジュアルスタイル・フォント等を含む最終的な有効 CSS。
   * 公開時にこの CSS を published_css として保存することで
   * 公開ページにも背景画像・スタイルが正しく反映される。
   */
  effectiveCss?: string;
}

// ─── 公開前チェックリスト ──────────────────────────────────────────────────────

function PrePublishChecklist({ settings, title }: { settings: PublishSettings; title: string }) {
  const checks = [
    {
      label: "タイトル設定済み",
      ok: !!(settings.seo_title || title),
      required: false,
    },
    {
      label: "SEO タイトル設定済み",
      ok: !!settings.seo_title,
      required: false,
    },
    {
      label: "meta description 設定済み",
      ok: !!settings.seo_description,
      required: false,
    },
    {
      label: "OGP 画像設定済み",
      ok: !!settings.og_image,
      required: false,
    },
    {
      label: "Favicon 設定済み",
      ok: !!settings.favicon_url,
      required: false,
    },
  ];

  const incomplete = checks.filter((c) => !c.ok);
  if (incomplete.length === 0) return null;

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-1.5">
      <p className="text-[11px] font-black text-amber-700 uppercase tracking-wide">
        公開前チェック（任意）
      </p>
      {incomplete.map((c) => (
        <div key={c.label} className="flex items-center gap-1.5 text-xs text-amber-600">
          <span className="text-amber-400">△</span>
          <span>{c.label}が未設定です</span>
        </div>
      ))}
      <p className="text-[10px] text-amber-500 mt-1">未設定でも公開できます</p>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PublishPanel({
  open,
  onClose,
  effectiveCss,
  projectId,
  projectTitle,
  session,
  onPublishChange,
}: Props) {
  const { planType } = usePlan();
  const canPublish = planType ? PLAN_LIMITS[planType].canPublish : false;

  const [settings, setSettings]     = useState<PublishSettings | null>(null);
  const [fetching, setFetching]     = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [toast, setToast]           = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced]       = useState(false);
  const [showTracking, setShowTracking]       = useState(false);;
  /** 初回公開の確認ステップを表示中か */
  const [confirmingPublish, setConfirmingPublish] = useState(false);

  // スラッグ編集用
  const [slugInput, setSlugInput]   = useState("");
  const [slugDirty, setSlugDirty]   = useState(false);
  const [slugSaving, setSlugSaving] = useState(false);
  const [slugError, setSlugError]   = useState<string | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (typeof window !== "undefined" ? window.location.origin : "");

  // ── 設定取得 ────────────────────────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    if (!session || !projectId) return;
    setFetching(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const data = await res.json() as PublishSettings;
        setSettings(data);
        setSlugInput(data.slug ?? "");
        setSlugDirty(false);
        setSlugError(null);
      }
    } catch {
      setError("設定の読み込みに失敗しました");
    } finally {
      setFetching(false);
    }
  }, [session, projectId]);

  useEffect(() => {
    if (open && projectId) void fetchSettings();
  }, [open, projectId, fetchSettings]);

  // ── スラッグ保存 ────────────────────────────────────────────────────────────

  const handleSaveSlug = async () => {
    if (!session || !projectId) return;
    const trimmed = slugInput.trim();
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(trimmed)) {
      setSlugError("小文字英数字とハイフンのみ（先頭・末尾はハイフン不可）");
      return;
    }
    setSlugSaving(true);
    setSlugError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/seo`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ slug: trimmed }),
      });
      const json = await res.json() as { slug?: string; error?: string };
      if (!res.ok) {
        setSlugError(json.error ?? "変更に失敗しました");
        return;
      }
      const newSlug = json.slug ?? null;
      setSettings((prev) => prev ? { ...prev, slug: newSlug } : prev);
      setSlugInput(newSlug ?? "");
      setSlugDirty(false);
      onPublishChange?.(settings?.is_published ?? false, newSlug);
      showToast("URLを変更しました ✓");
    } catch {
      setSlugError("通信エラーが発生しました");
    } finally {
      setSlugSaving(false);
    }
  };

  // ── SEO 保存 ────────────────────────────────────────────────────────────────

  const handleSaveSeo = async () => {
    if (!session || !projectId || !settings) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/seo`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          seo_title:        settings.seo_title,
          seo_description:  settings.seo_description,
          og_image:         settings.og_image,
          favicon_url:      settings.favicon_url,
          custom_css:       settings.custom_css,
          custom_head_html: settings.custom_head_html,
          noindex:          settings.noindex,
          meta_pixel_id:    settings.meta_pixel_id,
          ga4_id:           settings.ga4_id,
          gtm_id:           settings.gtm_id,
        }),
      });
      if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? "保存失敗");
      showToast("SEO設定を保存しました ✓");
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  };

  // ── 公開 / 非公開 ──────────────────────────────────────────────────────────

  const handleTogglePublish = async () => {
    if (!session || !projectId || !settings) return;
    const action = settings.is_published ? "unpublish" : "publish";
    setPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/publish`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ action, ...(effectiveCss ? { css: effectiveCss } : {}) }),
      });
      const json = await res.json() as PublishSettings & { error?: string; code?: string };
      if (!res.ok) {
        if (json.code === "PLAN_LIMIT") {
          setError("LP公開はProプランで利用できます");
        } else {
          throw new Error(json.error ?? "失敗しました");
        }
        return;
      }
      setSettings((prev) => prev ? { ...prev, ...json } : json);
      showToast(action === "publish" ? "公開しました 🚀" : "非公開にしました");
      onPublishChange?.(json.is_published, json.slug);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setPublishing(false);
    }
  };

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  function updateField<K extends keyof PublishSettings>(key: K, value: PublishSettings[K]) {
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  if (!open) return null;

  const publicUrl  = settings?.slug ? `${appUrl}/p/${settings.slug}` : null;
  const previewUrl = projectId ? `${appUrl}/preview/${projectId}` : null;

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <span className="text-lg">🚀</span>
          <h2 className="text-base font-black text-gray-900 flex-1">LP公開設定</h2>
          {toast && (
            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
              {toast}
            </span>
          )}
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 text-sm transition-colors"
          >✕</button>
        </div>

        <div className="p-5 space-y-5 flex-1">

          {/* ── クラウド未保存の警告 ── */}
          {!projectId && (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
              <p className="font-bold mb-1">まず保存が必要です</p>
              <p className="text-xs">「保存 ▾ → クラウドに保存」をしてから公開できます。</p>
            </div>
          )}

          {/* ── Trial ユーザー向け Lock ── */}
          {projectId && !canPublish && (
            <div className="rounded-xl bg-[#F0FBFD] border border-[#b3e8f4] p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">🔒</span>
                <p className="text-sm font-black text-[#007a96]">LP公開はProプランで利用できます</p>
              </div>
              <p className="text-xs text-[#00AFCC] leading-relaxed">
                プレビュー URL でクライアントへ共有することは可能です。<br />
                公開URLを使ってインターネット上に公開するにはProプランが必要です。
              </p>
              {previewUrl && (
                <div className="flex items-center gap-2 bg-white border border-[#b3e8f4] rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold text-[#007a96] shrink-0">プレビュー</span>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#00AFCC] truncate hover:underline flex-1"
                  >
                    {previewUrl}
                  </a>
                  <button
                    onClick={() => { void navigator.clipboard.writeText(previewUrl); showToast("コピーしました"); }}
                    className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0"
                  >
                    コピー
                  </button>
                </div>
              )}
              <a
                href="/pricing"
                className="block w-full py-2.5 text-center text-sm font-black text-white bg-[#00AFCC] hover:bg-[#0099b3] rounded-xl transition-colors mt-1"
              >
                Proプランを見る →
              </a>
            </div>
          )}

          {/* ── 公開状態 ── */}
          {projectId && canPublish && !fetching && settings && (
            <>
              {/* Public / Preview URLs */}
              <div className="space-y-2">
                {settings.is_published && publicUrl ? (
                  <div className="rounded-xl bg-green-50 border border-green-200 p-3.5">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 shrink-0" />
                      <span className="text-xs font-black text-green-700">公開中</span>
                      <span className="text-[10px] text-green-500">
                        {settings.published_at
                          ? new Date(settings.published_at).toLocaleDateString("ja-JP")
                          : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 bg-white border border-green-200 rounded-lg px-3 py-2">
                      <span className="text-[10px] font-bold text-green-600 shrink-0">公開URL</span>
                      <a
                        href={publicUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-green-600 truncate hover:underline flex-1"
                      >
                        {publicUrl}
                      </a>
                      <button
                        onClick={() => { void navigator.clipboard.writeText(publicUrl); showToast("コピーしました"); }}
                        className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0"
                      >
                        コピー
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-gray-50 border border-gray-200 p-3.5 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
                    <span className="text-xs text-gray-500">非公開（まだ公開されていません）</span>
                  </div>
                )}

                {/* Preview URL（常時表示）*/}
                {previewUrl && (
                  <div className="flex items-center gap-2 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2">
                    <span className="text-[10px] font-bold text-gray-400 shrink-0">プレビュー</span>
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 truncate hover:underline flex-1"
                    >
                      {previewUrl}
                    </a>
                    <button
                      onClick={() => { void navigator.clipboard.writeText(previewUrl); showToast("コピーしました"); }}
                      className="text-[10px] text-gray-400 hover:text-gray-600 shrink-0"
                    >
                      コピー
                    </button>
                  </div>
                )}
              </div>

              {/* ── 公開URL スラッグ編集 ── */}
              <div className="space-y-1.5">
                <label className="block text-xs font-black text-gray-600 uppercase tracking-wide">
                  公開URL
                </label>
                <div className={`flex items-center gap-0 rounded-xl border px-3 py-2 transition-colors ${slugError ? "border-red-300 bg-red-50" : "border-gray-200 bg-gray-50 focus-within:border-[#00AFCC] focus-within:bg-white"}`}>
                  <span className="text-[11px] text-gray-400 shrink-0 whitespace-nowrap select-none">
                    {appUrl}/p/
                  </span>
                  <input
                    type="text"
                    value={slugInput}
                    onChange={(e) => {
                      setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                      setSlugDirty(true);
                      setSlugError(null);
                    }}
                    placeholder="my-landing-page"
                    className="flex-1 text-[11px] text-gray-800 bg-transparent focus:outline-none min-w-0 font-mono"
                  />
                  {slugDirty && (
                    <button
                      onClick={() => { void handleSaveSlug(); }}
                      disabled={slugSaving || !slugInput.trim()}
                      className="shrink-0 ml-2 text-[10px] font-bold text-white bg-[#00AFCC] hover:bg-[#0099b3] px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {slugSaving ? "保存中" : "変更"}
                    </button>
                  )}
                </div>
                {settings.is_published && slugDirty && !slugError && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-1">
                    <span>⚠</span> URLが変わると既存のリンクは無効になります
                  </p>
                )}
                {slugError && (
                  <p className="text-[10px] text-red-500">{slugError}</p>
                )}
                {!slugDirty && settings.slug && (
                  <p className="text-[10px] text-gray-400">
                    小文字英数字とハイフンのみ使用できます
                  </p>
                )}
              </div>

              {/* Pre-publish checklist */}
              {!settings.is_published && (
                <PrePublishChecklist settings={settings} title={projectTitle} />
              )}

              {/* ── アクセス解析・広告タグ設定 ── */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowTracking((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span className="flex items-center gap-1.5">
                    <span>📊</span>
                    アクセス解析・広告タグ設定
                  </span>
                  <span className={`transition-transform ${showTracking ? "rotate-180" : ""}`}>▾</span>
                </button>
                {showTracking && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                    <p className="text-[11px] text-gray-400 mt-3 leading-relaxed">
                      Meta Pixel、Google Analytics、Google Tag Managerなどの計測タグを設定できます。広告配信やアクセス解析を行う場合に使用します。
                    </p>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Meta Pixel ID
                        <span className="ml-1 text-gray-400 font-normal">（例: 123456789012345）</span>
                      </label>
                      <input
                        type="text"
                        value={settings.meta_pixel_id ?? ""}
                        onChange={(e) => updateField("meta_pixel_id", e.target.value || null)}
                        placeholder="数字15桁"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Google Analytics 4 測定ID
                        <span className="ml-1 text-gray-400 font-normal">（例: G-XXXXXXXXXX）</span>
                      </label>
                      <input
                        type="text"
                        value={settings.ga4_id ?? ""}
                        onChange={(e) => updateField("ga4_id", e.target.value || null)}
                        placeholder="G-XXXXXXXXXX"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC] font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        Google Tag Manager ID
                        <span className="ml-1 text-gray-400 font-normal">（例: GTM-XXXXXXX）</span>
                      </label>
                      <input
                        type="text"
                        value={settings.gtm_id ?? ""}
                        onChange={(e) => updateField("gtm_id", e.target.value || null)}
                        placeholder="GTM-XXXXXXX"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC] font-mono"
                      />
                    </div>

                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      ※ プレビューページでは計測タグは発火しません。公開LP上でのみ動作します。
                    </p>
                  </div>
                )}
              </div>

              {/* ── SEO / OGP 設定 ── */}
              <div className="space-y-3">
                <h3 className="text-xs font-black text-gray-600 uppercase tracking-wide">SEO / OGP 設定</h3>

                <div className="space-y-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      SEO タイトル <span className="text-gray-400 font-normal">（未設定の場合はプロジェクト名を使用）</span>
                    </label>
                    <input
                      type="text"
                      value={settings.seo_title ?? ""}
                      onChange={(e) => updateField("seo_title", e.target.value || null)}
                      placeholder={projectTitle}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      meta description
                    </label>
                    <textarea
                      value={settings.seo_description ?? ""}
                      onChange={(e) => updateField("seo_description", e.target.value || null)}
                      placeholder="検索結果に表示される説明文（120文字程度）"
                      rows={2}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC] resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      OGP 画像 URL <span className="text-gray-400 font-normal">（SNS シェア時のサムネイル）</span>
                    </label>
                    <input
                      type="url"
                      value={settings.og_image ?? ""}
                      onChange={(e) => updateField("og_image", e.target.value || null)}
                      placeholder="https://example.com/og-image.png"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Favicon URL <span className="text-gray-400 font-normal">（PNG / ICO）</span>
                    </label>
                    <input
                      type="url"
                      value={settings.favicon_url ?? ""}
                      onChange={(e) => updateField("favicon_url", e.target.value || null)}
                      placeholder="https://example.com/favicon.png"
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC]"
                    />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.noindex}
                      onChange={(e) => updateField("noindex", e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-[#00AFCC] focus:ring-[#00AFCC]/30"
                    />
                    <span className="text-xs text-gray-600">
                      noindex（検索エンジンにインデックスさせない）
                    </span>
                  </label>
                </div>
              </div>

              {/* ── 上級者向け設定（Accordion）── */}
              <div className="border border-gray-100 rounded-xl overflow-hidden">
                <button
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
                >
                  <span>上級者向け設定（custom CSS / head HTML）</span>
                  <span className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`}>▾</span>
                </button>
                {showAdvanced && (
                  <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
                    <div className="mt-3">
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        カスタム CSS
                      </label>
                      <textarea
                        value={settings.custom_css ?? ""}
                        onChange={(e) => updateField("custom_css", e.target.value || null)}
                        placeholder="/* 公開ページにのみ適用される追加 CSS */"
                        rows={3}
                        className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC] resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                        カスタム &lt;head&gt; HTML
                        <span className="ml-1 text-gray-400 font-normal">（GA・Meta Pixel・Search Console など）</span>
                      </label>
                      <textarea
                        value={settings.custom_head_html ?? ""}
                        onChange={(e) => updateField("custom_head_html", e.target.value || null)}
                        placeholder={"<!-- Google Analytics, Meta Pixel, etc. -->\n<script>...</script>"}
                        rows={4}
                        className="w-full px-3 py-2 text-xs font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00AFCC]/30 focus:border-[#00AFCC] resize-none"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">
                        script タグは公開ページの &lt;head&gt; に挿入されます
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* エラー */}
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}
            </>
          )}

          {/* ── ローディング ── */}
          {fetching && (
            <div className="py-8 text-center text-gray-400 text-sm">読み込み中...</div>
          )}
        </div>

        {/* Footer */}
        {projectId && canPublish && settings && !fetching && (
          <div className="px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white space-y-2.5">
            {/* 初回公開 確認ステップ */}
            {confirmingPublish && !settings.is_published && (
              <div className="rounded-xl bg-amber-50 border border-amber-200 p-3.5 space-y-2">
                <p className="text-xs font-black text-amber-700">本当に公開しますか？</p>
                <p className="text-[11px] text-amber-600 leading-relaxed">
                  公開URLが発行され、インターネット上で誰でも閲覧できるようになります。
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmingPublish(false)}
                    className="flex-1 py-2 text-xs font-semibold border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={() => { setConfirmingPublish(false); void handleTogglePublish(); }}
                    disabled={publishing}
                    className="flex-1 py-2 text-xs font-black text-white bg-[#00AFCC] hover:bg-[#0099b3] rounded-lg transition-colors disabled:opacity-60"
                  >
                    {publishing ? "処理中..." : "公開する"}
                  </button>
                </div>
              </div>
            )}

            <div className="flex gap-2.5">
              <button
                onClick={handleSaveSeo}
                disabled={saving}
                className="flex-1 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 disabled:opacity-60 transition-colors"
              >
                {saving ? "保存中..." : "設定を保存"}
              </button>
              <button
                onClick={() => {
                  if (!settings.is_published) {
                    // 初回公開は確認ステップを挟む
                    setConfirmingPublish(true);
                  } else {
                    // 非公開化はワンクリックでOK
                    void handleTogglePublish();
                  }
                }}
                disabled={publishing}
                className={`flex-1 py-2.5 text-sm font-black rounded-xl transition-colors disabled:opacity-60
                  ${settings.is_published
                    ? "border border-red-200 text-red-500 hover:bg-red-50"
                    : "bg-[#00AFCC] hover:bg-[#0099b3] text-white shadow-sm"
                  }`}
              >
                {publishing
                  ? "処理中..."
                  : settings.is_published
                  ? "非公開にする"
                  : "🚀 公開する"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
