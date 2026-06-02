"use client";

import { useState, useEffect } from "react";
import { LPFormData, CTAType } from "@/types";

interface Props {
  onSubmit: (data: LPFormData) => void;
  loading: boolean;
  /** 外部（SiteImporter など）から流し込む初期値。変化するたびにフォームへ反映される。 */
  importedValues?: Partial<LPFormData>;
}

const DESIGN_MOODS = [
  "ナチュラル・温かみ",
  "クール・スタイリッシュ",
  "かわいい・ポップ",
  "高級感・プレミアム",
  "信頼感・誠実",
  "元気・アクティブ",
];

const emptyForm: LPFormData = {
  industry: "",
  target: "",
  area: "",
  serviceName: "",
  serviceDetail: "",
  price: "",
  strengths: "",
  designMood: DESIGN_MOODS[0],
  ctaType: "line",
  ctaLink: "",
};

export default function LPForm({ onSubmit, loading, importedValues }: Props) {
  const [form, setForm] = useState<LPFormData>(emptyForm);

  // importedValues が更新されたらフォームへマージ
  useEffect(() => {
    if (!importedValues) return;
    setForm((prev) => ({ ...prev, ...importedValues }));
  }, [importedValues]);

  const set = (key: keyof LPFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="業種 *" required>
          <input
            className={inputClass}
            placeholder="例：整骨院、美容室、税理士事務所"
            value={form.industry}
            onChange={set("industry")}
            required
          />
        </Field>

        <Field label="ターゲット *" required>
          <input
            className={inputClass}
            placeholder="例：30〜50代の腰痛に悩む女性"
            value={form.target}
            onChange={set("target")}
            required
          />
        </Field>

        <Field label="地域">
          <input
            className={inputClass}
            placeholder="例：東京都渋谷区"
            value={form.area}
            onChange={set("area")}
          />
        </Field>

        <Field label="サービス名 *" required>
          <input
            className={inputClass}
            placeholder="例：らく楽整骨院"
            value={form.serviceName}
            onChange={set("serviceName")}
            required
          />
        </Field>
      </div>

      <Field label="サービス内容 *" required>
        <textarea
          className={textareaClass}
          rows={3}
          placeholder="例：産後の骨盤矯正に特化した整骨院。独自の施術で平均5回で改善。"
          value={form.serviceDetail}
          onChange={set("serviceDetail")}
          required
        />
      </Field>

      <Field label="価格">
        <input
          className={inputClass}
          placeholder="例：初回体験 2,980円 / 通常 5,500円〜"
          value={form.price}
          onChange={set("price")}
        />
      </Field>

      <Field label="強み">
        <textarea
          className={textareaClass}
          rows={3}
          placeholder="例：・駅徒歩2分&#10;・予約制で待ち時間なし&#10;・女性施術師在籍"
          value={form.strengths}
          onChange={set("strengths")}
        />
      </Field>

      <Field label="デザイン雰囲気">
        <select className={inputClass} value={form.designMood} onChange={set("designMood")}>
          {DESIGN_MOODS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3.5 px-6 rounded-xl font-bold text-white text-lg
          bg-[#00AFCC] hover:bg-[#0099B3]
          disabled:opacity-50 disabled:cursor-not-allowed
          transition-all duration-200 shadow-md hover:shadow-lg"
      >
        {loading ? "LP生成中…" : "✨ LPを生成する"}
      </button>
    </form>
  );
}

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3.5 py-2.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00AFCC] focus:border-transparent transition";
const textareaClass = inputClass + " resize-none";
