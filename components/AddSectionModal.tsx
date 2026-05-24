"use client";

import { useState, useRef, useCallback } from "react";
import { SECTION_TEMPLATES, SectionTemplate } from "@/lib/sectionTemplates";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (html: string, css: string, templateId: string) => void;
}

type Phase = "pick" | "configure";

// ── imgblock 専用設定 UI ──────────────────────────────────────────────────────

interface ImgBlockConfigureProps {
  values: Record<string, string>;
  setValues: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  onBack: () => void;
  onSubmit: () => void;
}

function ImgBlockConfigure({
  values,
  setValues,
  onBack,
  onSubmit,
}: ImgBlockConfigureProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const previewUrl = values.imageUrl ?? "";

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) =>
        setValues((v) => ({ ...v, imageUrl: e.target?.result as string }));
      reader.readAsDataURL(file);
    },
    [setValues],
  );

  const upd = (key: string, val: string) =>
    setValues((v) => ({ ...v, [key]: val }));

  const alignment = (values.alignment || "center") as "left" | "center" | "right";

  return (
    <div className="p-6 space-y-5">
      {/* ── 画像アップロード ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          画像アップロード <span className="text-red-500">*</span>
        </label>

        {previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="プレビュー"
              className="w-full h-40 object-contain rounded-xl border border-gray-200 bg-gray-50"
            />
            <button
              type="button"
              onClick={() => setValues((v) => ({ ...v, imageUrl: "" }))}
              className="absolute top-2 right-2 bg-white/90 text-gray-500 hover:text-red-500 rounded-full w-6 h-6 flex items-center justify-center shadow border border-gray-200 text-xs transition-colors"
            >
              ✕
            </button>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-2 w-full py-2 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
            >
              差し替え
            </button>
          </div>
        ) : (
          <div
            onClick={() => fileRef.current?.click()}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            className={`w-full h-36 flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer select-none transition-colors ${
              isDragging
                ? "border-indigo-400 bg-indigo-50"
                : "border-gray-300 hover:border-indigo-300 hover:bg-indigo-50/50"
            }`}
          >
            <span className="text-3xl">🖼️</span>
            <p className="text-sm font-semibold text-gray-600">
              クリックまたはドラッグ＆ドロップ
            </p>
            <p className="text-xs text-gray-400">JPG / PNG / WebP 対応</p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {/* ── URL 入力（折りたたみ）── */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => setUrlOpen((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
        >
          <span>🔗 URLで指定する</span>
          <span className="text-gray-400">{urlOpen ? "▲" : "▼"}</span>
        </button>
        {urlOpen && (
          <div className="px-3 pb-3 pt-1">
            <input
              type="url"
              placeholder="https://example.com/image.jpg"
              value={previewUrl.startsWith("data:") ? "" : previewUrl}
              onChange={(e) => upd("imageUrl", e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
            />
          </div>
        )}
      </div>

      {/* ── altテキスト ── */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">
          altテキスト
        </label>
        <input
          type="text"
          placeholder="サービスイメージ写真"
          value={values.alt ?? ""}
          onChange={(e) => upd("alt", e.target.value)}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>

      {/* ── 配置 ── */}
      <div className="space-y-1.5">
        <label className="block text-sm font-semibold text-gray-700">配置</label>
        <div className="flex gap-1.5">
          {(["left", "center", "right"] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => upd("alignment", a)}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg border transition-colors ${
                alignment === a
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              }`}
            >
              {a === "left" ? "← 左" : a === "center" ? "中央" : "右 →"}
            </button>
          ))}
        </div>
      </div>

      {/* ── バナープリセット ── */}
      <div>
        <p className="text-xs font-semibold text-gray-500 mb-1.5">プリセット</p>
        <button
          type="button"
          onClick={() => {
            upd("paddingTop",    "0");
            upd("paddingBottom", "0");
            upd("paddingH",      "0");
            upd("width",         "100%");
            upd("borderRadius",  "0");
            upd("alignment",     "center");
          }}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 transition-colors"
        >
          🖼️ バナー（余白なし・横幅100%）
        </button>
      </div>

      {/* ── 詳細設定グリッド ── */}
      <div className="grid grid-cols-2 gap-3">
        {(
          [
            { key: "width",        label: "横幅",    placeholder: "100%" },
            { key: "height",       label: "高さ",    placeholder: "auto" },
            { key: "borderRadius", label: "角丸",    placeholder: "0" },
            { key: "paddingTop",   label: "上余白",  placeholder: "0" },
            { key: "paddingBottom",label: "下余白",  placeholder: "0" },
            { key: "paddingH",     label: "左右余白", placeholder: "0" },
          ] as const
        ).map(({ key, label, placeholder }) => (
          <div key={key} className="space-y-1">
            <label className="block text-xs font-semibold text-gray-600">
              {label}
            </label>
            <input
              type="text"
              placeholder={placeholder}
              value={values[key] ?? placeholder}
              onChange={(e) => upd(key, e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        ))}
      </div>

      {/* ── ボタン ── */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
        >
          戻る
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!previewUrl}
          className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg text-sm font-semibold transition-colors"
        >
          追加する
        </button>
      </div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────────────────────

export default function AddSectionModal({ open, onClose, onAdd }: Props) {
  const [phase, setPhase] = useState<Phase>("pick");
  const [selected, setSelected] = useState<SectionTemplate | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});

  if (!open) return null;

  const handleClose = () => {
    onClose();
    setPhase("pick");
    setSelected(null);
    setValues({});
  };

  const handlePick = (template: SectionTemplate) => {
    if (template.inputs && template.inputs.length > 0) {
      const defaults: Record<string, string> = {};
      for (const inp of template.inputs) {
        if (inp.defaultValue) defaults[inp.key] = inp.defaultValue;
      }
      setValues(defaults);
      setSelected(template);
      setPhase("configure");
    } else {
      onAdd(template.generateHtml({}), template.generateCss(), template.id);
      handleClose();
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!selected) return;
    onAdd(selected.generateHtml(values), selected.generateCss(), selected.id);
    handleClose();
  };

  const goBack = () => {
    setPhase("pick");
    setSelected(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {phase === "configure" && (
              <button
                onClick={goBack}
                className="text-gray-400 hover:text-gray-600 mr-1 text-lg leading-none"
                title="戻る"
              >
                ←
              </button>
            )}
            <h2 className="text-base font-bold text-gray-900">
              {phase === "pick"
                ? "セクションを追加"
                : `${selected?.label} を設定`}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {/* ── Phase: Pick ── */}
          {phase === "pick" && (
            <div className="p-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
              {SECTION_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handlePick(t)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-center group"
                >
                  <span className="text-3xl">{t.icon}</span>
                  <span className="text-sm font-semibold text-gray-800 group-hover:text-indigo-700">
                    {t.label}
                  </span>
                  <span className="text-[11px] text-gray-400 leading-snug">
                    {t.description}
                  </span>
                  {t.inputs && t.inputs.length > 0 && (
                    <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      設定あり
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}

          {/* ── Phase: Configure ── */}
          {phase === "configure" && selected && (
            <>
              {/* imgblock 専用 UI */}
              {selected.id === "imgblock" ? (
                <ImgBlockConfigure
                  values={values}
                  setValues={setValues}
                  onBack={goBack}
                  onSubmit={handleSubmit}
                />
              ) : (
                /* 汎用フォーム */
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                  <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                    <span className="text-2xl">{selected.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-indigo-900">
                        {selected.label}
                      </p>
                      <p className="text-xs text-indigo-600">
                        {selected.description}
                      </p>
                    </div>
                  </div>

                  {selected.inputs
                    ?.filter(
                      (inp) =>
                        !inp.dependsOn ||
                        values[inp.dependsOn.key] === inp.dependsOn.value,
                    )
                    .map((inp) => (
                      <div key={inp.key} className="space-y-1.5">
                        <label className="block text-sm font-semibold text-gray-700">
                          {inp.label}
                          {inp.required && (
                            <span className="text-red-500 ml-1">*</span>
                          )}
                        </label>
                        {inp.type === "select" ? (
                          <select
                            value={values[inp.key] ?? inp.defaultValue ?? ""}
                            onChange={(e) =>
                              setValues((v) => ({
                                ...v,
                                [inp.key]: e.target.value,
                              }))
                            }
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 bg-white"
                          >
                            {inp.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={inp.type ?? "text"}
                            placeholder={inp.placeholder}
                            value={values[inp.key] ?? ""}
                            onChange={(e) =>
                              setValues((v) => ({
                                ...v,
                                [inp.key]: e.target.value,
                              }))
                            }
                            required={inp.required}
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                          />
                        )}
                      </div>
                    ))}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={goBack}
                      className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      戻る
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold transition-colors"
                    >
                      追加する
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
