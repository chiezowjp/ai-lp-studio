"use client";

/**
 * FormConfigPanel — エディター内のフォーム設定パネル
 *
 * - フォーム有効/無効トグル
 * - フィールド追加・削除・並び替え
 * - 各フィールドの設定（ラベル・placeholder・必須・選択肢）
 * - 送信設定（ボタン文言・完了メッセージ・リダイレクト）
 * - 通知設定（メール・Google Sheets・Webhook）
 * - /api/projects/[id]/form-config PATCH で保存
 */

import { useState, useEffect, useCallback } from "react";
import type { FormConfig, FormField, FieldType } from "@/lib/form-schema";
import { DEFAULT_FORM_CONFIG } from "@/lib/form-schema";
import { useAuth } from "@/lib/auth-context";

interface Props {
  projectId: string | null;
  projectSlug: string | null;
  isPublished: boolean;
}

// ─── ユーティリティ ───────────────────────────────────────────────────────────

function genId() {
  return `f_${Math.random().toString(36).slice(2, 9)}`;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  text:     "テキスト",
  email:    "メール",
  tel:      "電話番号",
  textarea: "テキストエリア",
  select:   "セレクト",
  radio:    "ラジオ",
  checkbox: "チェックボックス",
};

// ─── フィールドエディター ─────────────────────────────────────────────────────

function FieldEditor({
  field,
  index,
  total,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  field: FormField;
  index: number;
  total: number;
  onChange: (f: FormField) => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasOptions = ["select", "radio", "checkbox"].includes(field.type);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* 行ヘッダー */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-50 cursor-pointer" onClick={() => setOpen((o) => !o)}>
        <span className="text-[10px] text-gray-400 font-mono w-4 text-center shrink-0">{index + 1}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-gray-700 truncate">{field.label || "（ラベルなし）"}</p>
          <p className="text-[10px] text-gray-400">{FIELD_TYPE_LABELS[field.type]}{field.required ? " · 必須" : ""}</p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onMoveUp(); }}
            disabled={index === 0}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed text-xs"
          >↑</button>
          <button
            onClick={(e) => { e.stopPropagation(); onMoveDown(); }}
            disabled={index === total - 1}
            className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 disabled:opacity-20 disabled:cursor-not-allowed text-xs"
          >↓</button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 text-xs"
          >✕</button>
        </div>
        <span className="text-[10px] text-gray-400 ml-1">{open ? "▲" : "▾"}</span>
      </div>

      {/* 展開エリア */}
      {open && (
        <div className="px-3 py-3 space-y-3 border-t border-gray-100">
          {/* ラベル */}
          <div>
            <label className="text-[11px] font-semibold text-gray-600 block mb-1">ラベル</label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC]"
            />
          </div>

          {/* タイプ */}
          <div>
            <label className="text-[11px] font-semibold text-gray-600 block mb-1">タイプ</label>
            <select
              value={field.type}
              onChange={(e) => onChange({ ...field, type: e.target.value as FieldType, options: [] })}
              className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC] bg-white"
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>

          {/* Placeholder */}
          {!hasOptions && (
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">プレースホルダー</label>
              <input
                type="text"
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC]"
              />
            </div>
          )}

          {/* 選択肢 */}
          {hasOptions && (
            <div>
              <label className="text-[11px] font-semibold text-gray-600 block mb-1">選択肢（1行1つ）</label>
              <textarea
                rows={4}
                value={(field.options ?? []).join("\n")}
                onChange={(e) =>
                  onChange({
                    ...field,
                    options: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean),
                  })
                }
                className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC] resize-none font-mono"
                placeholder={"選択肢A\n選択肢B\n選択肢C"}
              />
            </div>
          )}

          {/* 必須 */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
              className="accent-[#00AFCC]"
            />
            <span className="text-xs text-gray-700">必須項目</span>
          </label>
        </div>
      )}
    </div>
  );
}

// ─── メインコンポーネント ─────────────────────────────────────────────────────

export default function FormConfigPanel({ projectId, projectSlug, isPublished }: Props) {
  const { session } = useAuth();
  const [config, setConfig] = useState<FormConfig>(DEFAULT_FORM_CONFIG);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<"fields" | "submit" | "notifications">("fields");

  // ── フォーム設定を取得 ──
  useEffect(() => {
    if (!projectId || !session) return;
    setLoading(true);
    fetch(`/api/projects/${projectId}/form-config`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<FormConfig>;
      })
      .then((data) => setConfig(data))
      .catch((e) => console.error("form-config fetch error:", e))
      .finally(() => setLoading(false));
  }, [projectId, session]);

  // ── 保存 ──
  const save = useCallback(async (cfg: FormConfig) => {
    if (!projectId || !session) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/form-config`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(cfg),
      });
      if (!res.ok) {
        const j = await res.json();
        setError((j as { error?: string }).error ?? "保存に失敗しました");
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch {
      setError("ネットワークエラー");
    } finally {
      setSaving(false);
    }
  }, [projectId]);

  // ── フィールド操作 ──
  const sortedFields = [...config.fields].sort((a, b) => a.order - b.order);

  const updateField = (id: string, updated: FormField) => {
    setConfig((c) => ({
      ...c,
      fields: c.fields.map((f) => (f.id === id ? updated : f)),
    }));
  };

  const deleteField = (id: string) => {
    setConfig((c) => ({ ...c, fields: c.fields.filter((f) => f.id !== id) }));
  };

  const moveField = (id: string, dir: "up" | "down") => {
    const arr = [...sortedFields];
    const idx = arr.findIndex((f) => f.id === id);
    if (dir === "up" && idx === 0) return;
    if (dir === "down" && idx === arr.length - 1) return;
    const swapIdx = dir === "up" ? idx - 1 : idx + 1;
    [arr[idx], arr[swapIdx]] = [arr[swapIdx], arr[idx]];
    setConfig((c) => ({
      ...c,
      fields: arr.map((f, i) => ({ ...f, order: i })),
    }));
  };

  const addField = () => {
    const newField: FormField = {
      id:          genId(),
      type:        "text",
      name:        `field_${Date.now()}`,
      label:       "新しい項目",
      placeholder: "",
      required:    false,
      order:       config.fields.length,
    };
    setConfig((c) => ({ ...c, fields: [...c.fields, newField] }));
  };

  if (!projectId) {
    return (
      <div className="p-4 text-xs text-gray-500 bg-amber-50 border border-amber-200 rounded-xl">
        📋 フォーム設定はクラウドに保存してから使用できます。
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 flex items-center gap-2 text-xs text-gray-400">
        <span className="w-3 h-3 border-2 border-gray-300 border-t-[#00AFCC] rounded-full animate-spin" />
        読み込み中…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* フォーム ON/OFF */}
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
        <div>
          <p className="text-xs font-bold text-gray-700">フォームを有効にする</p>
          <p className="text-[10px] text-gray-400 mt-0.5">公開ページに「お問い合わせ」ボタンを表示</p>
        </div>
        <button
          onClick={() => setConfig((c) => ({ ...c, enabled: !c.enabled }))}
          className={`w-11 h-6 rounded-full transition-colors relative overflow-hidden ${
            config.enabled ? "bg-[#00AFCC]" : "bg-gray-300"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
              config.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {/* Trial 警告 */}
      {isPublished === false && (
        <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          ⚠ 本番フォーム送信は Pro プランで利用可能です。プレビューでのテストはご利用いただけます。
        </p>
      )}

      {config.enabled && (
        <>
          {/* タブ */}
          <div className="flex border border-gray-200 rounded-lg overflow-hidden text-[11px]">
            {(["fields", "submit", "notifications"] as const).map((tab) => {
              const labels = { fields: "📋 フィールド", submit: "✉ 送信", notifications: "🔔 通知" };
              return (
                <button
                  key={tab}
                  onClick={() => setActiveSection(tab)}
                  className={`flex-1 py-2 font-semibold transition-colors ${
                    activeSection === tab
                      ? "bg-[#00AFCC] text-white"
                      : "text-gray-500 hover:bg-gray-50"
                  }`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </div>

          {/* ─ フィールド ─ */}
          {activeSection === "fields" && (
            <div className="space-y-2">
              {sortedFields.map((field, idx) => (
                <FieldEditor
                  key={field.id}
                  field={field}
                  index={idx}
                  total={sortedFields.length}
                  onChange={(updated) => updateField(field.id, updated)}
                  onDelete={() => deleteField(field.id)}
                  onMoveUp={() => moveField(field.id, "up")}
                  onMoveDown={() => moveField(field.id, "down")}
                />
              ))}
              <button
                onClick={addField}
                className="w-full py-2.5 border-2 border-dashed border-[#D8D8D2] hover:border-[#00AFCC] hover:bg-[#E6F8FC] text-[#00AFCC] font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1"
              >
                <span className="text-base leading-none">＋</span> フィールドを追加
              </button>
            </div>
          )}

          {/* ─ 送信設定 ─ */}
          {activeSection === "submit" && (
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">送信ボタンのテキスト</label>
                <input
                  type="text"
                  value={config.submitButtonText}
                  onChange={(e) => setConfig((c) => ({ ...c, submitButtonText: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC]"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">送信完了メッセージ</label>
                <textarea
                  rows={3}
                  value={config.successMessage}
                  onChange={(e) => setConfig((c) => ({ ...c, successMessage: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC] resize-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                  送信完了後のリダイレクト URL
                  <span className="font-normal text-gray-400 ml-1">（任意）</span>
                </label>
                <input
                  type="url"
                  placeholder="https://example.com/thanks"
                  value={config.redirectUrl ?? ""}
                  onChange={(e) =>
                    setConfig((c) => ({ ...c, redirectUrl: e.target.value || null }))
                  }
                  className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC]"
                />
              </div>
            </div>
          )}

          {/* ─ 通知設定 ─ */}
          {activeSection === "notifications" && (
            <div className="space-y-4">
              {/* メール通知 */}
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-50">
                  <p className="text-xs font-bold text-gray-700">📧 メール通知</p>
                  <button
                    onClick={() =>
                      setConfig((c) => ({
                        ...c,
                        emailNotification: {
                          ...c.emailNotification,
                          enabled: !c.emailNotification.enabled,
                        },
                      }))
                    }
                    className={`w-9 h-5 rounded-full transition-colors relative overflow-hidden ${
                      config.emailNotification.enabled ? "bg-[#00AFCC]" : "bg-gray-300"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                        config.emailNotification.enabled ? "translate-x-4" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
                {config.emailNotification.enabled && (
                  <div className="px-3 py-3">
                    <label className="text-[11px] font-semibold text-gray-600 block mb-1">
                      送信先メール
                      <span className="font-normal text-gray-400 ml-1">（空 = アカウントのメール）</span>
                    </label>
                    <input
                      type="email"
                      placeholder="owner@example.com"
                      value={config.emailNotification.toEmail ?? ""}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          emailNotification: {
                            ...c.emailNotification,
                            toEmail: e.target.value || null,
                          },
                        }))
                      }
                      className="w-full border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-[#00AFCC]"
                    />
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      )}

      {/* フッター: 保存ボタン */}
      {error && (
        <p className="text-xs text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
      )}
      <button
        onClick={() => save(config)}
        disabled={saving || !projectId}
        className="w-full py-2.5 bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-colors"
      >
        {saving ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            保存中…
          </span>
        ) : saved ? (
          "✓ 保存しました"
        ) : (
          "フォーム設定を保存"
        )}
      </button>

      {projectSlug && (
        <p className="text-[10px] text-gray-400 text-center">
          送信先: /api/submit/{projectSlug}
        </p>
      )}
    </div>
  );
}
