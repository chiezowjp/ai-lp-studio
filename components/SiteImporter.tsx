"use client";

import { useState } from "react";
import { ExtractedSiteData, LPFormData } from "@/types";
import { useAuth } from "@/lib/auth-context";

interface Props {
  onApply: (data: Partial<LPFormData>) => void;
}

type Phase = "input" | "loading" | "result" | "error";

const PREVIEW_FIELDS: { key: keyof ExtractedSiteData; label: string }[] = [
  { key: "serviceName", label: "サービス名" },
  { key: "industry",    label: "業種" },
  { key: "target",      label: "ターゲット" },
  { key: "area",        label: "地域" },
  { key: "serviceDetail", label: "サービス内容" },
  { key: "price",       label: "価格" },
  { key: "strengths",   label: "強み" },
  { key: "designMood",  label: "デザイン雰囲気" },
  { key: "ctaType",     label: "CTA種別" },
  { key: "ctaLink",     label: "CTAリンク" },
];

const EXTRA_FIELDS: { key: keyof ExtractedSiteData; icon: string; label: string }[] = [
  { key: "address",      icon: "📍", label: "住所" },
  { key: "phone",        icon: "📞", label: "電話" },
  { key: "businessHours",icon: "🕐", label: "営業時間" },
  { key: "seoKeywords",  icon: "🔍", label: "SEOキーワード" },
  { key: "imageStyle",   icon: "🖼", label: "画像スタイル" },
];

export default function SiteImporter({ onApply }: Props) {
  const { session } = useAuth();
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedSiteData | null>(null);
  const [showFallback, setShowFallback] = useState(false);
  const [fallbackText, setFallbackText] = useState("");

  // ── fetch + analyze flow ──────────────────────────────────────────────────

  const runAnalyze = async (text: string, title?: string, siteUrl?: string) => {
    setLoadingMsg("AIがサイト情報を解析しています…");
    const res = await fetch("/api/analyze-site", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ text, title, url: siteUrl }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "解析に失敗しました");
    return json as ExtractedSiteData;
  };

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setPhase("loading");
    setError(null);
    setExtracted(null);
    setShowFallback(false);
    try {
      setLoadingMsg("サイトを取得しています…");
      const res = await fetch("/api/fetch-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "取得に失敗しました");
        setShowFallback(true);
        setPhase("error");
        return;
      }
      const data = await runAnalyze(json.text, json.title, trimmed);
      setExtracted(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setShowFallback(true);
      setPhase("error");
    }
  };

  const handleFallbackAnalyze = async () => {
    if (!fallbackText.trim()) return;
    setPhase("loading");
    setError(null);
    try {
      const data = await runAnalyze(fallbackText.trim());
      setExtracted(data);
      setPhase("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "解析に失敗しました");
      setPhase("error");
    }
  };

  const handleApply = () => {
    if (!extracted) return;
    const ctaType = (["line", "phone", "contact"].includes(extracted.ctaType)
      ? extracted.ctaType
      : "contact") as "line" | "phone" | "contact";
    onApply({
      serviceName:   extracted.serviceName,
      industry:      extracted.industry,
      target:        extracted.target,
      area:          extracted.area,
      serviceDetail: extracted.serviceDetail,
      price:         extracted.price,
      strengths:     extracted.strengths,
      designMood:    extracted.designMood,
      ctaType,
      ctaLink:       extracted.ctaLink,
    });
  };

  const handleReset = () => {
    setPhase("input");
    setError(null);
    setExtracted(null);
    setShowFallback(false);
    setFallbackText("");
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* URL input (always visible) */}
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-gray-700">
          既存サイトのURL
        </label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && phase !== "loading" && handleFetch()}
            placeholder="https://example.com"
            disabled={phase === "loading"}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition disabled:opacity-50"
          />
          <button
            onClick={handleFetch}
            disabled={!url.trim() || phase === "loading"}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            取得
          </button>
        </div>
        <p className="text-[11px] text-gray-400">
          トップページのURLを入力してください。サーバー経由で安全に取得します。
        </p>
      </div>

      {/* Loading */}
      {phase === "loading" && (
        <div className="flex items-center gap-3 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
          <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
          <p className="text-xs text-indigo-700">{loadingMsg}</p>
        </div>
      )}

      {/* Error */}
      {phase === "error" && error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 space-y-2">
          <p className="text-xs text-red-700">
            <strong>エラー：</strong>{error}
          </p>
        </div>
      )}

      {/* Fallback textarea */}
      {(phase === "error" || showFallback) && !extracted && (
        <div className="space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
          <p className="text-xs font-semibold text-gray-600">
            📋 テキストを貼り付けて解析
          </p>
          <p className="text-[11px] text-gray-400">
            サイトのテキストをブラウザで選択してコピーし、ここに貼り付けてください。
          </p>
          <textarea
            value={fallbackText}
            onChange={(e) => setFallbackText(e.target.value)}
            rows={5}
            placeholder="サイトのテキストをここに貼り付けてください…"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
          />
          <button
            onClick={handleFallbackAnalyze}
            disabled={!fallbackText.trim() || phase === "loading"}
            className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            AIで解析する
          </button>
        </div>
      )}

      {/* Result */}
      {phase === "result" && extracted && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-700">抽出された情報</span>
            <span className="text-xs text-green-600 font-medium">✓ 解析完了</span>
          </div>

          <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
            {PREVIEW_FIELDS.filter((f) => extracted[f.key]).map(({ key, label }) => (
              <div key={key} className="flex gap-2 px-3 py-2 border-b border-gray-100 last:border-0">
                <span className="text-gray-400 shrink-0 w-20 pt-px">{label}</span>
                <span className="text-gray-700 flex-1 break-all leading-relaxed">
                  {extracted[key]}
                </span>
              </div>
            ))}

            {/* Extra info block */}
            {EXTRA_FIELDS.some((f) => extracted[f.key]) && (
              <div className="bg-gray-50 px-3 py-2 space-y-1 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-1.5">
                  参考情報（フォームには反映されません）
                </p>
                {EXTRA_FIELDS.filter((f) => extracted[f.key]).map(({ key, icon, label }) => (
                  <p key={key} className="text-gray-500">
                    {icon} <span className="text-gray-400">{label}：</span>
                    {extracted[key]}
                  </p>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleApply}
            className="w-full py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold text-sm rounded-xl transition-all shadow-sm"
          >
            フォームに反映して入力画面へ →
          </button>

          <button
            onClick={handleReset}
            className="w-full py-1.5 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            やり直す
          </button>
        </div>
      )}
    </div>
  );
}
