"use client";

/**
 * FormWidget — 公開LP に埋め込まれるフォームウィジェット
 *
 * 動作:
 *   1. LP 内に `data-lp-form` 属性を持つ要素があればインラインレンダリング
 *   2. 常にフローティング「お問い合わせ」ボタンを右下に表示
 *   3. ボタンクリックでモーダルフォームを開く
 *
 * Trial プラン: ボタンは表示するが送信時に「Pro限定」を案内
 * Pro プラン  : 実際に /api/submit/[slug] へ送信
 */

import { useState, useEffect, useCallback } from "react";
import type { FormConfig, FormField } from "@/lib/form-schema";

interface Props {
  config: FormConfig;
  slug: string;
  isPro: boolean;
}

// ─── 単一フィールドレンダー ────────────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: FormField;
  value: string | string[];
  onChange: (v: string | string[]) => void;
  error?: string;
}) {
  const baseClass =
    "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-800 outline-none focus:border-[#00AFCC] focus:ring-1 focus:ring-[#00AFCC]/30 transition-colors placeholder:text-gray-400";
  const errorClass = "border-red-400 focus:border-red-400 focus:ring-red-200";

  const id = `form-${field.id}`;

  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-xs font-semibold text-gray-700 flex items-center gap-1">
        {field.label}
        {field.required && <span className="text-red-500">*</span>}
      </label>
      {field.type === "textarea" ? (
        <textarea
          id={id}
          rows={4}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} resize-none ${error ? errorClass : ""}`}
        />
      ) : field.type === "select" ? (
        <select
          id={id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} bg-white ${error ? errorClass : ""}`}
        >
          <option value="">選択してください</option>
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      ) : field.type === "radio" ? (
        <div className="space-y-1.5">
          {field.options?.map((opt) => (
            <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
              <input
                type="radio"
                name={field.name}
                value={opt}
                checked={value === opt}
                onChange={() => onChange(opt)}
                className="accent-[#00AFCC]"
              />
              {opt}
            </label>
          ))}
        </div>
      ) : field.type === "checkbox" ? (
        <div className="space-y-1.5">
          {field.options?.map((opt) => {
            const arr = Array.isArray(value) ? value : [];
            return (
              <label key={opt} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={arr.includes(opt)}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...arr, opt]
                      : arr.filter((v) => v !== opt);
                    onChange(next);
                  }}
                  className="accent-[#00AFCC]"
                />
                {opt}
              </label>
            );
          })}
        </div>
      ) : (
        <input
          id={id}
          type={field.type}
          placeholder={field.placeholder}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className={`${baseClass} ${error ? errorClass : ""}`}
        />
      )}
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}

// ─── フォーム本体 ─────────────────────────────────────────────────────────────

function FormBody({
  config,
  slug,
  isPro,
  onSuccess,
}: {
  config: FormConfig;
  slug: string;
  isPro: boolean;
  onSuccess: (message: string, redirectUrl: string | null) => void;
}) {
  const sortedFields = [...config.fields].sort((a, b) => a.order - b.order);
  const [values, setValues] = useState<Record<string, string | string[]>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  const updateValue = useCallback((name: string, v: string | string[]) => {
    setValues((prev) => ({ ...prev, [name]: v }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // クライアントバリデーション
    const newErrors: Record<string, string> = {};
    for (const field of sortedFields) {
      const val = values[field.name];
      const isEmpty = !val || (Array.isArray(val) ? val.length === 0 : val.trim() === "");
      if (field.required && isEmpty) {
        newErrors[field.name] = `${field.label}は必須です`;
      }
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (!isPro) {
      setGlobalError("フォーム受信は Pro プランでご利用いただけます。");
      return;
    }

    setSubmitting(true);
    setGlobalError(null);

    try {
      const res = await fetch(`/api/submit/${slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, _hp: "" }),
      });
      const json = await res.json();
      if (!res.ok) {
        setGlobalError((json as { error?: string }).error ?? "送信に失敗しました。");
      } else {
        onSuccess(
          (json as { message?: string }).message ?? config.successMessage,
          (json as { redirectUrl?: string | null }).redirectUrl ?? null,
        );
      }
    } catch {
      setGlobalError("ネットワークエラーが発生しました。");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Honeypot */}
      <input type="text" name="_hp" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />

      {sortedFields.map((field) => (
        <FieldInput
          key={field.id}
          field={field}
          value={values[field.name] ?? (field.type === "checkbox" ? [] : "")}
          onChange={(v) => updateValue(field.name, v)}
          error={errors[field.name]}
        />
      ))}

      {globalError && (
        <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{globalError}</p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full py-3 bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-60 text-white font-bold rounded-xl transition-colors text-sm"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            送信中…
          </span>
        ) : (
          config.submitButtonText
        )}
      </button>
    </form>
  );
}

// ─── モーダル ─────────────────────────────────────────────────────────────────

function FormModal({
  config,
  slug,
  isPro,
  onClose,
}: {
  config: FormConfig;
  slug: string;
  isPro: boolean;
  onClose: () => void;
}) {
  const [done, setDone] = useState(false);
  const [doneMessage, setDoneMessage] = useState("");

  const handleSuccess = (message: string, redirectUrl: string | null) => {
    setDoneMessage(message);
    setDone(true);
    if (redirectUrl) {
      setTimeout(() => { window.location.href = redirectUrl; }, 2000);
    }
  };

  // ESC で閉じる
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-4 sm:p-6"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <h2 className="text-base font-bold text-gray-800">お問い合わせ</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* ボディ */}
        <div className="overflow-y-auto flex-1 px-5 py-5">
          {done ? (
            <div className="flex flex-col items-center text-center py-8 gap-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center text-3xl">
                ✓
              </div>
              <p className="text-sm text-gray-700 font-medium leading-relaxed">{doneMessage}</p>
              <button onClick={onClose} className="text-xs text-[#00AFCC] font-semibold">
                閉じる
              </button>
            </div>
          ) : (
            <FormBody
              config={config}
              slug={slug}
              isPro={isPro}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── エクスポート ─────────────────────────────────────────────────────────────

export default function FormWidget({ config, slug, isPro }: Props) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!config.enabled) return null;

  return (
    <>
      {/* フローティングボタン */}
      <button
        onClick={() => setModalOpen(true)}
        className="fixed bottom-6 right-6 z-[9000] flex items-center gap-2 px-5 py-3 bg-[#00AFCC] hover:bg-[#0099B3] text-white font-bold rounded-full shadow-lg transition-all hover:scale-105 text-sm"
        aria-label="お問い合わせフォームを開く"
      >
        ✉ お問い合わせ
      </button>

      {/* モーダル */}
      {modalOpen && (
        <FormModal
          config={config}
          slug={slug}
          isPro={isPro}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  );
}
