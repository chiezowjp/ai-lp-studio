"use client";

/**
 * components/AiImprovePanel.tsx
 *
 * AI CV 改善提案パネル。
 * エディター右サイドバーまたはモーダルとして表示。
 *
 * props:
 *   projectId   — プロジェクト ID
 *   html        — 現在の LP HTML
 *   css         — 現在の LP CSS
 *   formData    — LP のフォームデータ（サービス情報）
 *   analytics   — Analytics サマリー（任意）
 *   onApply     — 改善適用コールバック（htmlPatch がある場合）
 *   onClose     — 閉じるコールバック
 */

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";

// ─── 型定義 ───────────────────────────────────────────────────────────────────

interface Suggestion {
  category: string;
  problem: string;
  suggestion: string;
  reason: string;
  expectedEffect: string;
  priority: "high" | "medium" | "low";
  htmlPatch?: string;
}

interface AiImproveResult {
  suggestions: Suggestion[];
  overallScore: number;
  overallFeedback: string;
}

interface Props {
  projectId: string;
  html: string;
  css: string;
  formData?: Record<string, unknown>;
  analytics?: {
    totalPageViews?: number;
    uniqueVisitors?: number;
    ctaClickRate?: number;
    formOpenRate?: number;
    formSubmitRate?: number;
    scrollDepths?: { depth: number; count: number }[];
    deviceBreakdown?: { device: string; count: number }[];
  };
  onApply?: (htmlPatch: string) => void;
  onClose: () => void;
}

// ─── ヘルパー ─────────────────────────────────────────────────────────────────

const CATEGORY_LABEL: Record<string, string> = {
  cta:        "📣 CTA",
  headline:   "✏️ 見出し",
  form:       "📋 フォーム",
  firstview:  "🖼 ファーストビュー",
  color:      "🎨 色彩",
  layout:     "📐 レイアウト",
  copy:       "💬 コピー",
  trust:      "🏆 信頼性",
};

const PRIORITY_STYLE: Record<string, string> = {
  high:   "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low:    "bg-gray-100 text-gray-600 border-gray-200",
};

const PRIORITY_LABEL: Record<string, string> = {
  high:   "優先度: 高",
  medium: "優先度: 中",
  low:    "優先度: 低",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "bg-green-400" : score >= 60 ? "bg-amber-400" : "bg-red-400";
  const label = score >= 80 ? "良好" : score >= 60 ? "普通" : "要改善";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-100 rounded-full h-2.5">
        <div className={`${color} h-2.5 rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-bold ${score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600"}`}>
        {score} / 100（{label}）
      </span>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function AiImprovePanel({
  projectId, html, css, formData, analytics, onApply, onClose,
}: Props) {
  const { session } = useAuth();
  const [result, setResult]     = useState<AiImproveResult | null>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [filterPriority, setFilterPriority] = useState<string>("all");

  const generate = async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ai-improve", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, html, css, formData, analytics }),
      });
      const j = await res.json() as AiImproveResult & { error?: string; code?: string };
      if (!res.ok) {
        if (j.code === "PLAN_LIMIT") {
          setError("AI改善提案は Pro プランでご利用いただけます。");
        } else {
          setError(j.error ?? "生成に失敗しました");
        }
        return;
      }
      setResult(j);
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const filtered = result?.suggestions.filter(
    (s) => filterPriority === "all" || s.priority === filterPriority,
  ) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-bold text-gray-800">🤖 AI CV 改善提案</h2>
            <p className="text-xs text-gray-500 mt-0.5">LP の問題点を分析し、CVR 改善策を提案します</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* 未生成 */}
          {!result && !loading && (
            <div className="text-center py-8">
              {error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700 text-sm mb-4">
                  {error}
                </div>
              ) : (
                <>
                  <p className="text-4xl mb-3">🎯</p>
                  <p className="text-sm text-gray-600 mb-1">LP の HTML と Analytics データを AI が分析します</p>
                  <p className="text-xs text-gray-400">
                    {analytics?.totalPageViews
                      ? `直近 ${analytics.totalPageViews.toLocaleString()} PV のデータを含めて分析`
                      : "Analytics データがない場合は HTML 分析のみ"}
                  </p>
                </>
              )}
              <button
                onClick={generate}
                className="mt-6 bg-[#00AFCC] text-white px-6 py-2.5 rounded-xl font-medium text-sm hover:bg-[#0099b5] transition-colors"
              >
                ✨ 改善提案を生成（analyze 1回消費）
              </button>
            </div>
          )}

          {/* 生成中 */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block w-8 h-8 border-4 border-[#00AFCC] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-600">LP を分析中です…（10〜20秒）</p>
            </div>
          )}

          {/* 結果 */}
          {result && (
            <>
              {/* スコア */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-600 mb-2">総合スコア</p>
                <ScoreBar score={result.overallScore} />
                <p className="text-xs text-gray-600 mt-3 leading-relaxed">{result.overallFeedback}</p>
              </div>

              {/* フィルター */}
              <div className="flex gap-1.5">
                {["all", "high", "medium", "low"].map((p) => (
                  <button
                    key={p}
                    onClick={() => setFilterPriority(p)}
                    className={`text-xs px-3 py-1 rounded-full border transition-all ${
                      filterPriority === p
                        ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                        : "border-gray-200 text-gray-600"
                    }`}
                  >
                    {p === "all" ? "すべて" : PRIORITY_LABEL[p]}
                    <span className="ml-1 opacity-70">
                      {p === "all"
                        ? result.suggestions.length
                        : result.suggestions.filter((s) => s.priority === p).length}
                    </span>
                  </button>
                ))}
              </div>

              {/* 提案リスト */}
              <div className="space-y-2">
                {filtered.map((s, i) => (
                  <div
                    key={i}
                    className="border border-gray-200 rounded-xl overflow-hidden"
                  >
                    {/* 見出し行 */}
                    <button
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 text-left"
                      onClick={() => setExpanded(expanded === i ? null : i)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-medium ${PRIORITY_STYLE[s.priority]}`}>
                          {s.priority === "high" ? "🔴 高" : s.priority === "medium" ? "🟡 中" : "🟢 低"}
                        </span>
                        <span className="text-xs font-medium text-[#00AFCC]">
                          {CATEGORY_LABEL[s.category] ?? s.category}
                        </span>
                        <span className="text-sm text-gray-700 truncate">{s.problem}</span>
                      </div>
                      <span className="shrink-0 text-gray-400 ml-2">{expanded === i ? "▲" : "▼"}</span>
                    </button>

                    {/* 詳細 */}
                    {expanded === i && (
                      <div className="border-t border-gray-100 px-4 py-4 space-y-3 text-sm">
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">改善案</p>
                          <p className="text-gray-800">{s.suggestion}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">理由・根拠</p>
                          <p className="text-gray-600 text-xs leading-relaxed">{s.reason}</p>
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-gray-500 mb-1">期待効果</p>
                          <p className="text-green-700 text-xs font-medium">{s.expectedEffect}</p>
                        </div>
                        {s.htmlPatch && onApply && (
                          <button
                            onClick={() => { onApply(s.htmlPatch!); onClose(); }}
                            className="text-xs bg-[#00AFCC] text-white px-3 py-1.5 rounded-lg hover:bg-[#0099b5]"
                          >
                            ✅ この改善を適用
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* 再生成 */}
              <div className="text-center pt-2">
                <button
                  onClick={generate}
                  className="text-xs text-gray-500 hover:text-[#00AFCC] underline"
                >
                  🔄 再生成（analyze 1回消費）
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
