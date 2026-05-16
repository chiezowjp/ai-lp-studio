"use client";

import { useState } from "react";
import { SECTION_TEMPLATES, SectionTemplate } from "@/lib/sectionTemplates";

interface Props {
  open: boolean;
  onClose: () => void;
  onAdd: (html: string, css: string, templateId: string) => void;
}

type Phase = "pick" | "configure";

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
      // Pre-fill defaults
      const defaults: Record<string, string> = {};
      for (const inp of template.inputs) {
        if (inp.defaultValue) defaults[inp.key] = inp.defaultValue;
      }
      setValues(defaults);
      setSelected(template);
      setPhase("configure");
    } else {
      // No input needed — add immediately
      const html = template.generateHtml({});
      const css = template.generateCss();
      onAdd(html, css, template.id);
      handleClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const html = selected.generateHtml(values);
    const css = selected.generateCss();
    onAdd(html, css, selected.id);
    handleClose();
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            {phase === "configure" && (
              <button
                onClick={() => { setPhase("pick"); setSelected(null); }}
                className="text-gray-400 hover:text-gray-600 mr-1 text-lg leading-none"
                title="戻る"
              >←</button>
            )}
            <h2 className="text-base font-bold text-gray-900">
              {phase === "pick" ? "セクションを追加" : `${selected?.label} を設定`}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors text-lg"
          >×</button>
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
                  <span className="text-[11px] text-gray-400 leading-snug">{t.description}</span>
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
            <form onSubmit={handleSubmit} className="p-6 space-y-5">
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                <span className="text-2xl">{selected.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-indigo-900">{selected.label}</p>
                  <p className="text-xs text-indigo-600">{selected.description}</p>
                </div>
              </div>

              {selected.inputs?.map((inp) => (
                <div key={inp.key} className="space-y-1.5">
                  <label className="block text-sm font-semibold text-gray-700">
                    {inp.label}
                    {inp.required && <span className="text-red-500 ml-1">*</span>}
                  </label>
                  <input
                    type={inp.type ?? "text"}
                    placeholder={inp.placeholder}
                    value={values[inp.key] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [inp.key]: e.target.value }))}
                    required={inp.required}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setPhase("pick"); setSelected(null); }}
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
        </div>
      </div>
    </div>
  );
}
