"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  ImagePromptConfig, ImagePromptResult, SavedImagePrompt,
  ImageAITool, ImagePlacementLP, ImageMood, ImageSizeType, ImageBrightnessType,
  LPFormData,
} from "@/types";

// ─── Option data ──────────────────────────────────────────────────────────────

const AI_TOOLS: { id: ImageAITool; label: string; icon: string; note: string }[] = [
  { id: "chatgpt",        label: "ChatGPT",         icon: "🤖", note: "DALL-E 3" },
  { id: "midjourney",     label: "Midjourney",      icon: "🎨", note: "v6対応" },
  { id: "canva",          label: "Canva",            icon: "✏️", note: "AI生成" },
  { id: "gemini",         label: "Gemini",           icon: "💎", note: "Imagen" },
  { id: "leonardo",       label: "Leonardo AI",      icon: "🖼️", note: "PhotoReal" },
  { id: "stablediffusion",label: "Stable Diffusion", icon: "⚡", note: "SDXL等" },
  { id: "other",          label: "その他",            icon: "🔧", note: "汎用" },
];

const PLACEMENTS: { id: ImagePlacementLP; label: string; icon: string }[] = [
  { id: "hero",        label: "ファーストビュー", icon: "🖼️" },
  { id: "service",     label: "サービス紹介",     icon: "💼" },
  { id: "cta",         label: "CTA背景",          icon: "🎯" },
  { id: "testimonial", label: "お客様の声",        icon: "💬" },
  { id: "background",  label: "背景画像",          icon: "🌅" },
  { id: "gallery",     label: "ギャラリー",        icon: "📷" },
  { id: "beforeafter", label: "Before/After",     icon: "🔄" },
  { id: "other",       label: "その他",            icon: "📌" },
];

const MOODS: { id: ImageMood; label: string }[] = [
  { id: "luxury",    label: "高級感" },
  { id: "natural",   label: "ナチュラル" },
  { id: "soft",      label: "柔らかい" },
  { id: "simple",    label: "シンプル" },
  { id: "dark",      label: "黒系・ダーク" },
  { id: "light",     label: "白系・クリーン" },
  { id: "feminine",  label: "女性向け" },
  { id: "masculine", label: "男性向け" },
  { id: "hotel",     label: "高級ホテル風" },
  { id: "korean",    label: "韓国風" },
  { id: "nordic",    label: "北欧風" },
  { id: "modern",    label: "モダン" },
  { id: "japanese",  label: "和風" },
];

const SIZES: { id: ImageSizeType; label: string; ratio: string }[] = [
  { id: "landscape", label: "横長",     ratio: "16:9" },
  { id: "portrait",  label: "縦長",     ratio: "9:16" },
  { id: "square",    label: "正方形",   ratio: "1:1" },
  { id: "mobile",    label: "スマホ用", ratio: "9:16" },
];

const BRIGHTNESS: { id: ImageBrightnessType; label: string; desc: string }[] = [
  { id: "bright",  label: "明るめ",       desc: "ハイキー" },
  { id: "natural", label: "自然光",       desc: "ナチュラル" },
  { id: "studio",  label: "スタジオ照明", desc: "均一な光" },
  { id: "dark",    label: "暗め",         desc: "ローキー" },
];

const AGE_OPTIONS = ["10〜20代", "20〜30代", "30〜40代", "40〜50代", "50代以上", "子供", "ミドル層", "シニア"];
const AI_LABEL: Record<ImageAITool, string> = {
  chatgpt: "ChatGPT", midjourney: "Midjourney", canva: "Canva",
  gemini: "Gemini", leonardo: "Leonardo AI", stablediffusion: "Stable Diffusion", other: "汎用",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  lpContext?: LPFormData;
  savedPrompts: SavedImagePrompt[];
  onSave: (prompt: SavedImagePrompt) => void;
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
        copied ? "bg-green-100 text-green-700" : "bg-gray-100 hover:bg-indigo-100 text-gray-600 hover:text-indigo-700"
      }`}
    >
      {copied ? "✓ コピー済み" : "📋 コピー"}
    </button>
  );
}

// ─── Prompt card ──────────────────────────────────────────────────────────────

function PromptCard({ label, text, accent = false }: { label: string; text: string; accent?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${accent ? "border-indigo-200 bg-indigo-50" : "border-gray-200 bg-gray-50"}`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-bold ${accent ? "text-indigo-600" : "text-gray-500"}`}>{label}</span>
        <CopyBtn text={text} />
      </div>
      <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap break-words">{text}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type ConfigDraft = Partial<ImagePromptConfig>;

export default function ImagePromptAssistant({ open, onClose, lpContext, savedPrompts, onSave }: Props) {
  const { session } = useAuth();
  const [step, setStep] = useState(1);
  const [cfg, setCfg] = useState<ConfigDraft>({ moods: [], hasPeople: false, needsTextSpace: true });
  const [result, setResult] = useState<ImagePromptResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveLabel, setSaveLabel] = useState("");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [showSaved, setShowSaved] = useState(false);

  if (!open) return null;

  const set = <K extends keyof ConfigDraft>(k: K, v: ConfigDraft[K]) =>
    setCfg((prev) => ({ ...prev, [k]: v }));

  const toggleMood = (m: ImageMood) =>
    set("moods", (cfg.moods ?? []).includes(m)
      ? (cfg.moods ?? []).filter((x) => x !== m)
      : [...(cfg.moods ?? []), m]);

  const handleClose = () => {
    onClose();
    setStep(1);
    setCfg({ moods: [], hasPeople: false, needsTextSpace: true });
    setResult(null);
    setError(null);
    setSaveLabel("");
    setSavedId(null);
  };

  const canNext1 = !!cfg.aiTool && !!cfg.placement;
  const canNext2 = (cfg.moods?.length ?? 0) > 0 && !!cfg.brightness;
  const canGenerate = !!cfg.size;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/image-prompt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          config: cfg as ImagePromptConfig,
          lpContext: lpContext
            ? { industry: lpContext.industry, serviceName: lpContext.serviceName, target: lpContext.target, designMood: lpContext.designMood }
            : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成失敗");
      setResult(json as ImagePromptResult);
      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result || !saveLabel.trim() || !cfg.aiTool) return;
    const id = Date.now().toString();
    onSave({
      id,
      sectionLabel: saveLabel.trim(),
      aiTool: cfg.aiTool,
      config: cfg as ImagePromptConfig,
      result,
      createdAt: new Date().toLocaleString("ja-JP"),
    });
    setSavedId(id);
  };

  // ─── Progress indicator ──────────────────────────────────────────────────

  const steps = ["AI・用途", "スタイル", "詳細設定", step < 4 ? "生成" : "結果"];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900 flex items-center gap-2">
              🎨 AI画像プロンプト生成アシスタント
            </h2>
            {lpContext?.serviceName && (
              <p className="text-xs text-indigo-500 mt-0.5">LP：{lpContext.serviceName}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSaved(!showSaved)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${showSaved ? "bg-indigo-50 border-indigo-200 text-indigo-600" : "border-gray-200 text-gray-500 hover:bg-gray-50"}`}
            >
              保存済み ({savedPrompts.length})
            </button>
            <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 text-lg">×</button>
          </div>
        </div>

        {/* Progress */}
        <div className="flex px-6 pt-4 pb-2 gap-2 flex-shrink-0">
          {steps.map((label, i) => {
            const sn = i + 1;
            const active = step === sn;
            const done = step > sn;
            return (
              <div key={sn} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                  done ? "bg-green-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400"
                }`}>
                  {done ? "✓" : sn}
                </div>
                <span className={`text-xs font-medium truncate ${active ? "text-indigo-600" : done ? "text-green-600" : "text-gray-400"}`}>
                  {label}
                </span>
                {i < steps.length - 1 && <div className={`flex-1 h-px ${done ? "bg-green-300" : "bg-gray-200"}`} />}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* ── Saved prompts panel ── */}
          {showSaved && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
              <p className="text-xs font-bold text-indigo-700">保存済みプロンプト</p>
              {savedPrompts.length === 0 ? (
                <p className="text-xs text-gray-400">まだ保存がありません</p>
              ) : (
                savedPrompts.map((sp) => (
                  <div key={sp.id} className="bg-white rounded-lg border border-indigo-100 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-800">{sp.sectionLabel}</span>
                      <span className="text-[10px] text-gray-400">{sp.createdAt}</span>
                    </div>
                    <p className="text-[11px] text-indigo-600">{AI_LABEL[sp.aiTool]}</p>
                    <div className="flex gap-2">
                      <CopyBtn text={sp.result.optimized} />
                      <CopyBtn text={sp.result.english} />
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ═══ STEP 1: AI Tool + Placement ═══ */}
          {step === 1 && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">どの画像AIを使いますか？</p>
                <div className="grid grid-cols-4 gap-2">
                  {AI_TOOLS.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => set("aiTool", t.id)}
                      className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 text-center transition-all ${
                        cfg.aiTool === t.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"
                      }`}
                    >
                      <span className="text-xl">{t.icon}</span>
                      <span className="text-xs font-semibold text-gray-800">{t.label}</span>
                      <span className="text-[10px] text-gray-400">{t.note}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">画像の使用場所は？</p>
                <div className="grid grid-cols-4 gap-2">
                  {PLACEMENTS.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => set("placement", p.id)}
                      className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 text-center transition-all ${
                        cfg.placement === p.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"
                      }`}
                    >
                      <span className="text-lg">{p.icon}</span>
                      <span className="text-xs font-medium text-gray-700">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══ STEP 2: Mood + People + Brightness ═══ */}
          {step === 2 && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">雰囲気・スタイル（複数選択可）</p>
                <div className="flex flex-wrap gap-2">
                  {MOODS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => toggleMood(m.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
                        cfg.moods?.includes(m.id)
                          ? "border-indigo-500 bg-indigo-500 text-white"
                          : "border-gray-200 text-gray-600 hover:border-indigo-300"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                {(cfg.moods?.length ?? 0) === 0 && (
                  <p className="text-xs text-amber-500">少なくとも1つ選択してください</p>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">人物の有無</p>
                <div className="flex gap-3">
                  {[{ v: false, label: "👤 人物なし" }, { v: true, label: "👥 人物あり" }].map(({ v, label }) => (
                    <button
                      key={String(v)}
                      onClick={() => set("hasPeople", v)}
                      className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                        cfg.hasPeople === v ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-indigo-200"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {cfg.hasPeople && (
                  <div className="mt-3 space-y-3 p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold text-gray-600">年齢層</p>
                      <div className="flex flex-wrap gap-1.5">
                        {AGE_OPTIONS.map((age) => (
                          <button
                            key={age}
                            onClick={() => set("peopleAge", cfg.peopleAge === age ? undefined : age)}
                            className={`px-2.5 py-1 rounded-full text-xs border transition-all ${
                              cfg.peopleAge === age ? "border-indigo-400 bg-indigo-100 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-indigo-200"
                            }`}
                          >
                            {age}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-600">国籍</p>
                        <div className="flex flex-col gap-1">
                          {[{ v: "japanese", l: "日本人" }, { v: "foreign", l: "外国人" }, { v: "both", l: "両方" }].map(({ v, l }) => (
                            <button key={v} onClick={() => set("peopleNationality", v as "japanese" | "foreign" | "both")}
                              className={`py-1 rounded-lg text-xs border transition-all ${cfg.peopleNationality === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:border-indigo-200"}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <p className="text-xs font-semibold text-gray-600">性別</p>
                        <div className="flex flex-col gap-1">
                          {[{ v: "female", l: "女性" }, { v: "male", l: "男性" }, { v: "mixed", l: "男女" }].map(({ v, l }) => (
                            <button key={v} onClick={() => set("peopleGender", v as "female" | "male" | "mixed")}
                              className={`py-1 rounded-lg text-xs border transition-all ${cfg.peopleGender === v ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-500 hover:border-indigo-200"}`}>
                              {l}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">明るさ</p>
                <div className="grid grid-cols-4 gap-2">
                  {BRIGHTNESS.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => set("brightness", b.id)}
                      className={`flex flex-col items-center gap-1 py-2.5 rounded-xl border-2 text-center transition-all ${
                        cfg.brightness === b.id ? "border-indigo-500 bg-indigo-50" : "border-gray-100 hover:border-indigo-200"
                      }`}
                    >
                      <span className="text-xs font-semibold text-gray-800">{b.label}</span>
                      <span className="text-[10px] text-gray-400">{b.desc}</span>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ═══ STEP 3: Details ═══ */}
          {step === 3 && (
            <>
              <div className="space-y-1.5">
                <p className="text-sm font-bold text-gray-800">背景・シーンのイメージ（自由記述）</p>
                <textarea
                  value={cfg.backgroundDescription ?? ""}
                  onChange={(e) => set("backgroundDescription", e.target.value)}
                  placeholder="例：カフェの窓際、白い壁のスタジオ、都会のオフィス、自然の中のサロン、など"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none h-20 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-gray-800">カラー・色味</p>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={cfg.colorPreference?.match(/^#[0-9a-f]{6}$/i) ? cfg.colorPreference : "#f0f0f0"}
                      onChange={(e) => set("colorPreference", e.target.value)}
                      className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                    />
                    <input
                      type="text"
                      value={cfg.colorPreference ?? ""}
                      onChange={(e) => set("colorPreference", e.target.value)}
                      placeholder="例：アイボリー、ネイビー、#f5f0eb"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-indigo-400"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-sm font-bold text-gray-800">画像サイズ <span className="text-red-500">*</span></p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {SIZES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => set("size", s.id)}
                        className={`py-2 rounded-lg border text-xs font-semibold transition-all ${
                          cfg.size === s.id ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-gray-200 text-gray-600 hover:border-indigo-200"
                        }`}
                      >
                        {s.label} <span className="text-gray-400">{s.ratio}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-bold text-gray-800">文字・テキスト用の余白</p>
                <div className="flex gap-3">
                  {[{ v: true, label: "✅ 必要", desc: "見出し・CTAを重ねる" }, { v: false, label: "🖼️ 不要", desc: "画像そのものが主役" }].map(({ v, label, desc }) => (
                    <button
                      key={String(v)}
                      onClick={() => set("needsTextSpace", v)}
                      className={`flex-1 py-2.5 px-3 rounded-xl border-2 text-left transition-all ${
                        cfg.needsTextSpace === v ? "border-indigo-500 bg-indigo-50" : "border-gray-200 hover:border-indigo-200"
                      }`}
                    >
                      <span className="text-xs font-bold text-gray-800 block">{label}</span>
                      <span className="text-[11px] text-gray-500">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {!canGenerate && (
                <p className="text-xs text-amber-500 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  「画像サイズ」を選択してください
                </p>
              )}
              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
              )}
            </>
          )}

          {/* ═══ STEP 4: Results ═══ */}
          {step === 4 && result && (
            <>
              <PromptCard label="🇯🇵 日本語プロンプト" text={result.japanese} />
              <PromptCard label="🇺🇸 英語プロンプト" text={result.english} />
              <PromptCard
                label={`⚡ ${AI_LABEL[cfg.aiTool ?? "other"]} 最適化版`}
                text={result.optimized}
                accent
              />

              {result.tips.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                  <p className="text-xs font-bold text-amber-700">💡 LP活用アドバイス</p>
                  <ul className="space-y-1">
                    {result.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-amber-800 flex gap-2">
                        <span className="text-amber-400 shrink-0">▶</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Save */}
              <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <p className="text-xs font-bold text-gray-700">📂 プロンプトを保存</p>
                {savedId ? (
                  <p className="text-xs text-green-600 font-semibold">✓ 「{saveLabel}」として保存しました</p>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="例：ファーストビュー用、CTA背景"
                      value={saveLabel}
                      onChange={(e) => setSaveLabel(e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-indigo-400"
                    />
                    <button
                      onClick={handleSave}
                      disabled={!saveLabel.trim()}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
                    >
                      保存
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0">
          {step > 1 && step < 4 ? (
            <button onClick={() => setStep(step - 1)} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
              ← 戻る
            </button>
          ) : step === 4 ? (
            <button onClick={() => { setStep(3); setResult(null); setSavedId(null); }} className="text-sm text-gray-500 hover:text-gray-700 font-medium">
              ← 設定を変更
            </button>
          ) : <div />}

          {step === 1 && (
            <button
              onClick={() => setStep(2)}
              disabled={!canNext1}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
            >
              次へ →
            </button>
          )}
          {step === 2 && (
            <button
              onClick={() => setStep(3)}
              disabled={!canNext2}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-colors"
            >
              次へ →
            </button>
          )}
          {step === 3 && (
            <button
              onClick={handleGenerate}
              disabled={!canGenerate || loading}
              className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-40 text-white text-sm font-bold rounded-xl transition-all flex items-center gap-2"
            >
              {loading ? (
                <><div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />生成中…</>
              ) : "🪄 プロンプトを生成"}
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleClose}
              className="px-5 py-2.5 bg-gray-800 hover:bg-gray-900 text-white text-sm font-bold rounded-xl transition-colors"
            >
              閉じる
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
