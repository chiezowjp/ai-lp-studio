"use client";

import { useState, useCallback } from "react";
import { LPFormData, GeneratedLP, LPAnalysis, AnalyzedSection, CTAType, ImageToneAnalysis } from "@/types";

export type ProblemLayout = "normal" | "bubble";

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = "input" | "fetching" | "analyzing" | "review" | "generating";

interface Props {
  initialServiceData?: Partial<LPFormData>;
  onComplete: (result: GeneratedLP, formData: LPFormData, lpAnalysis: LPAnalysis, currentLayout: ProblemLayout) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const RETRY_DELAYS = [2000, 5000, 10000];

const EMPTY_FORM: LPFormData = {
  industry: "",
  target: "",
  area: "",
  serviceName: "",
  serviceDetail: "",
  price: "",
  strengths: "",
  designMood: "ナチュラル・温かみ",
  ctaType: "line",
  ctaLink: "",
};

const DESIGN_MOODS = [
  "ナチュラル・温かみ",
  "クール・スタイリッシュ",
  "かわいい・ポップ",
  "高級感・プレミアム",
  "信頼感・誠実",
  "元気・アクティブ",
];

// ─── Small helpers ────────────────────────────────────────────────────────────

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-700 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inp = "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 px-2 py-1 text-[10px] font-semibold rounded border transition-colors
        border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600"
    >
      {copied ? "✓ コピー済" : "コピー"}
    </button>
  );
}

function Tag({ label, ok }: { label: string; ok?: boolean }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
      ok === true ? "bg-green-100 text-green-700" :
      ok === false ? "bg-gray-100 text-gray-500" :
      "bg-indigo-50 text-indigo-700"
    }`}>
      {label}
    </span>
  );
}

// ─── Image Card ────────────────────────────────────────────────────────────────

function ImageCard({ img, index }: { img: ImageToneAnalysis; index: number }) {
  const [open, setOpen] = useState(false);

  const prompts = [
    { label: "ChatGPT / DALL-E 3", value: img.promptChatGPT },
    { label: "Midjourney", value: img.promptMidjourney },
    { label: "Canva AI", value: img.promptCanva },
    { label: "日本語", value: img.promptJa },
    { label: "英語汎用", value: img.promptEn },
  ];

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden bg-white">
      {/* Header row */}
      <div className="flex gap-3 p-3">
        {/* Thumbnail */}
        <div className="w-20 h-14 rounded-md overflow-hidden border border-gray-100 shrink-0 bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={img.url}
            alt={`参考画像 ${index + 1}`}
            className="w-full h-full object-cover"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        </div>

        {/* Analysis tags */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag label={img.placement} />
            <Tag label={img.mood} />
            <Tag label={img.brightness} />
            {img.hasPeople && <Tag label={`👤 ${img.ageGroup || "人物あり"}`} />}
            {img.textFriendly && <Tag label="📝 テキスト配置◎" ok={true} />}
          </div>
          <p className="text-[11px] text-gray-500 truncate">{img.composition}</p>
          <p className="text-[11px] text-gray-400 truncate">{img.colorTone}</p>
        </div>

        {/* Toggle */}
        <button
          onClick={() => setOpen(!open)}
          className="shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-semibold transition-colors self-start"
        >
          {open ? "▲ 閉じる" : "▼ プロンプト"}
        </button>
      </div>

      {/* Prompts panel */}
      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {/* Copyright notice */}
          <div className="px-3 py-2 bg-amber-50">
            <p className="text-[10px] text-amber-700">
              ⚠ 参考画像をコピーするのではなく、雰囲気・構図・色味を参考にしたオリジナル画像を作成してください。
            </p>
          </div>
          {prompts.map(({ label, value }) =>
            value ? (
              <div key={label} className="px-3 py-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-bold text-gray-600">{label}</span>
                  <CopyButton text={value} />
                </div>
                <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap">{value}</p>
              </div>
            ) : null
          )}
          {/* LP反映導線 */}
          <div className="px-3 py-2.5 bg-indigo-50">
            <p className="text-[10px] text-indigo-700">
              💡 生成した画像はLP生成後、左パネルの「画像」タブからアップロードしてLPに反映できます。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LPRefAnalyzer({ initialServiceData, onComplete }: Props) {
  const [phase, setPhase] = useState<Phase>("input");
  const [refUrl, setRefUrl] = useState("");
  const [fallbackText, setFallbackText] = useState("");
  const [showFallback, setShowFallback] = useState(false);

  const [analysis, setAnalysis] = useState<LPAnalysis | null>(null);
  const [sections, setSections] = useState<AnalyzedSection[]>([]);
  const [problemLayout, setProblemLayout] = useState<"normal" | "bubble">("normal");

  // Image tone analysis state
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [imageAnalyses, setImageAnalyses] = useState<ImageToneAnalysis[]>([]);
  const [imageAnalyzing, setImageAnalyzing] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);
  const [imageAnalyzed, setImageAnalyzed] = useState(false);

  const [form, setForm] = useState<LPFormData>({ ...EMPTY_FORM, ...initialServiceData });
  const setF = (k: keyof LPFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setForm((p) => ({ ...p, [k]: e.target.value }));

  const [error, setError] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");

  // ─── Fetch + Analyze ────────────────────────────────────────────────────────

  const runAnalysis = async (text: string, title?: string, url?: string, imgs: string[] = []) => {
    setPhase("analyzing");
    setLoadingMsg("AIがLP構成を分析しています…");
    const res = await fetch("/api/analyze-lp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, title, url }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "LP分析に失敗しました");
    const lpAnalysis = json as LPAnalysis;
    setAnalysis(lpAnalysis);
    setSections(lpAnalysis.sections ?? []);
    // 参考LPのデザインムードをフォームに自動反映（ユーザーが上書き可能）
    if (lpAnalysis.designMood) {
      setForm((p) => ({ ...p, designMood: lpAnalysis.designMood }));
    }
    // 吹き出しレイアウトが検出された場合、デフォルトを "bubble" に
    setProblemLayout(lpAnalysis.bubbleProblem ? "bubble" : "normal");
    setImageUrls(imgs);
    setImageAnalyzed(false);
    setImageAnalyses([]);
    setPhase("review");
  };

  const handleFetch = async () => {
    if (!refUrl.trim()) return;
    setError(null);
    setShowFallback(false);
    setPhase("fetching");
    setLoadingMsg("参考LPを取得しています…");
    try {
      const res = await fetch("/api/fetch-site", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: refUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "取得に失敗しました");
        setShowFallback(true);
        setPhase("input");
        return;
      }
      await runAnalysis(json.text, json.title, refUrl.trim(), json.imageUrls ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setShowFallback(true);
      setPhase("input");
    }
  };

  const handleFallbackAnalyze = async () => {
    if (!fallbackText.trim()) return;
    setError(null);
    try {
      await runAnalysis(fallbackText.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました");
      setPhase("input");
    }
  };

  // ─── Image tone analysis ─────────────────────────────────────────────────────

  const handleAnalyzeImages = useCallback(async () => {
    if (!imageUrls.length || imageAnalyzing) return;
    setImageAnalyzing(true);
    setImageError(null);
    try {
      const res = await fetch("/api/analyze-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls,
          industry: form.industry,
          serviceName: form.serviceName,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "画像分析に失敗しました");
      setImageAnalyses(json.analyses ?? []);
      setImageAnalyzed(true);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : "画像分析に失敗しました");
    } finally {
      setImageAnalyzing(false);
    }
  }, [imageUrls, imageAnalyzing, form.industry, form.serviceName]);

  // ─── Section editing ─────────────────────────────────────────────────────────

  const toggleSection = (id: string) =>
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, included: !s.included } : s)));

  const moveSection = (id: string, dir: -1 | 1) => {
    setSections((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      if (idx < 0) return prev;
      const next = [...prev];
      const swap = idx + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next.map((s, i) => ({ ...s, order: i + 1 }));
    });
  };

  // ─── Generate ────────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!analysis) return;
    const required: (keyof LPFormData)[] = ["serviceName", "industry", "target", "serviceDetail", "ctaLink"];
    const missing = required.find((k) => !form[k]);
    if (missing) { setError(`「${missing}」は必須です`); return; }
    const selected = sections.filter((s) => s.included);
    if (!selected.length) { setError("1つ以上のセクションを選択してください"); return; }

    setError(null);
    setRetryMsg(null);
    setPhase("generating");

    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      setLoadingMsg(retryMsg ?? "LP生成中…（30〜60秒）");
      const res = await fetch("/api/generate-from-ref", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analysis, selectedSections: selected, serviceInfo: form, problemLayout }),
      });
      const json = await res.json();
      if (res.ok) { onComplete(json as GeneratedLP, form, analysis!, problemLayout); return; }
      if (json.type === "overloaded" && attempt < RETRY_DELAYS.length) {
        const sec = RETRY_DELAYS[attempt] / 1000;
        setRetryMsg(`AIが混み合っています。${sec}秒後に再試行… (${attempt + 1}/${RETRY_DELAYS.length})`);
        await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        continue;
      }
      setError(json.error ?? "生成に失敗しました");
      setPhase("review");
      return;
    }
    setError("生成に失敗しました。しばらく時間をおいてから再試行してください。");
    setPhase("review");
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  const isLoading = phase === "fetching" || phase === "analyzing" || phase === "generating";

  return (
    <div className="space-y-5">
      {/* Copyright notice */}
      <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800">
        <span className="shrink-0">⚠️</span>
        <span>
          参考LPの文章・デザインをそのままコピーする目的ではなく、
          <strong>構成・導線・訴求の参考</strong>として利用してください。
          生成されるLPはすべて新規作成のオリジナルコンテンツです。
        </span>
      </div>

      {/* ── Input phase ── */}
      {!analysis && (
        <div className="space-y-5">
          {/* URL input */}
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-800">① 参考にしたいLPのURL</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={refUrl}
                onChange={(e) => setRefUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !isLoading && handleFetch()}
                placeholder="https://example.com/lp"
                disabled={isLoading}
                className={inp + " flex-1"}
              />
              <button
                onClick={handleFetch}
                disabled={!refUrl.trim() || isLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors whitespace-nowrap"
              >
                分析
              </button>
            </div>
          </div>

          {isLoading && (
            <div className="flex items-center gap-3 rounded-lg bg-indigo-50 border border-indigo-100 px-4 py-3">
              <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />
              <p className="text-xs text-indigo-700">{loadingMsg}</p>
            </div>
          )}

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <strong>エラー：</strong>{error}
            </div>
          )}

          {showFallback && (
            <div className="space-y-2 rounded-lg bg-gray-50 border border-gray-200 p-3">
              <p className="text-xs font-semibold text-gray-600">📋 テキストを貼り付けて分析</p>
              <textarea value={fallbackText} onChange={(e) => setFallbackText(e.target.value)} rows={5}
                placeholder="参考LPのテキストをコピーして貼り付けてください…" className={inp + " resize-none"} />
              <button onClick={handleFallbackAnalyze} disabled={!fallbackText.trim() || isLoading}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                AIで分析する
              </button>
            </div>
          )}

          {/* Service info */}
          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-800">② 作りたいサービス情報</label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="業種" required>
                <input className={inp} value={form.industry} onChange={setF("industry")} placeholder="整骨院、美容室…" />
              </Field>
              <Field label="サービス名" required>
                <input className={inp} value={form.serviceName} onChange={setF("serviceName")} placeholder="らく楽整骨院" />
              </Field>
              <Field label="ターゲット" required>
                <input className={inp} value={form.target} onChange={setF("target")} placeholder="30〜50代の腰痛に悩む女性" />
              </Field>
              <Field label="地域">
                <input className={inp} value={form.area} onChange={setF("area")} placeholder="東京都渋谷区" />
              </Field>
            </div>
            <Field label="サービス内容" required>
              <textarea className={inp + " resize-none"} rows={2} value={form.serviceDetail} onChange={setF("serviceDetail")} placeholder="産後の骨盤矯正に特化した整骨院…" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="価格">
                <input className={inp} value={form.price} onChange={setF("price")} placeholder="初回2,980円〜" />
              </Field>
              <Field label="デザイン雰囲気">
                <select className={inp} value={form.designMood} onChange={setF("designMood")}>
                  {DESIGN_MOODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
            </div>
            <Field label="強み">
              <textarea className={inp + " resize-none"} rows={2} value={form.strengths} onChange={setF("strengths")} placeholder="・駅徒歩2分&#10;・予約制で待ち時間なし" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="CTA種別">
                <select className={inp} value={form.ctaType} onChange={(e) => setForm((p) => ({ ...p, ctaType: e.target.value as CTAType }))}>
                  <option value="line">LINEで予約</option>
                  <option value="phone">電話</option>
                  <option value="contact">問い合わせフォーム</option>
                </select>
              </Field>
              <Field label="CTAリンク" required>
                <input className={inp} value={form.ctaLink} onChange={setF("ctaLink")} placeholder="https://lin.ee/xxx" />
              </Field>
            </div>
          </div>
        </div>
      )}

      {/* ── Review phase ── */}
      {phase === "review" && analysis && (
        <div className="space-y-5">
          {/* Analysis summary */}
          <div className="rounded-lg border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
              <p className="text-xs font-bold text-gray-700">📊 参考LP分析結果</p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              {[
                { label: "デザイン", value: analysis.designMood },
                { label: "色味", value: analysis.colorTone },
                { label: "見出しトーン", value: analysis.headlineTone },
                { label: "CTAの強さ", value: analysis.ctaStrength },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-1.5">
                  <span className="text-gray-400 shrink-0 w-20">{label}</span>
                  <span className="text-gray-700 font-medium">{value}</span>
                </div>
              ))}
              <div className="col-span-2 flex gap-1.5">
                <span className="text-gray-400 shrink-0 w-20">訴求の流れ</span>
                <span className="text-gray-700">{analysis.appealFlow}</span>
              </div>
              <div className="col-span-2 flex gap-1.5">
                <span className="text-gray-400 shrink-0 w-20">学ぶべき点</span>
                <span className="text-gray-700">{analysis.conversionStrategy}</span>
              </div>
            </div>
          </div>

          {/* Section editor */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-bold text-gray-800">セクション構成を調整</p>
              <span className="text-xs text-gray-400">{sections.filter((s) => s.included).length}/{sections.length} 選択中</span>
            </div>
            <div className="space-y-1.5">
              {sections.map((sec, idx) => (
                <div key={sec.id}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 transition-colors ${
                    sec.included ? "bg-white border-gray-200" : "bg-gray-50 border-gray-100 opacity-60"
                  }`}
                >
                  <input type="checkbox" checked={sec.included} onChange={() => toggleSection(sec.id)}
                    className="w-4 h-4 accent-indigo-600 rounded shrink-0" />
                  <span className="text-[10px] text-gray-400 w-5 text-center shrink-0">
                    {sec.included ? sec.order : "−"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{sec.name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{sec.role}</p>
                  </div>
                  <div className="flex gap-0.5 shrink-0">
                    <button onClick={() => moveSection(sec.id, -1)} disabled={idx === 0}
                      className="w-6 h-6 text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-25 rounded transition-colors">▲</button>
                    <button onClick={() => moveSection(sec.id, 1)} disabled={idx === sections.length - 1}
                      className="w-6 h-6 text-xs text-gray-400 hover:text-indigo-600 disabled:opacity-25 rounded transition-colors">▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 吹き出しレイアウト切り替え（お悩み系セクションがある場合に表示） */}
          {sections.some(s =>
            ["problem","trouble","worry","nayami"].some(k => s.id.includes(k)) ||
            ["悩み","問題","お困り","不安","こんな"].some(k => s.name.includes(k))
          ) && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-lg shrink-0">💬</span>
                <div>
                  <p className="text-xs font-bold text-indigo-800">お悩みセクションのレイアウト</p>
                  <p className="text-[11px] text-indigo-600 mt-0.5">
                    参考LPに吹き出し・チェックリスト型の悩み訴求が検出されました。生成レイアウトを選んでください。
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                {(
                  [
                    { id: "normal" as const,  label: "通常レイアウト",   desc: "テキスト段落・リスト形式", icon: "📝" },
                    { id: "bubble" as const,  label: "吹き出しレイアウト", desc: "CSS吹き出し・カード型",    icon: "💬" },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setProblemLayout(opt.id)}
                    className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-xl border-2 text-xs font-semibold transition-all ${
                      problemLayout === opt.id
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    <span className="text-xl">{opt.icon}</span>
                    <span>{opt.label}</span>
                    <span className={`text-[10px] font-normal ${problemLayout === opt.id ? "text-indigo-200" : "text-gray-400"}`}>
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
              {problemLayout === "bubble" && (
                <p className="text-[10px] text-indigo-600 bg-white rounded-lg px-3 py-2 border border-indigo-100">
                  ✓ 吹き出し型レイアウトで生成します。生成後、ビジュアル編集でスタイルを調整できます。
                </p>
              )}
            </div>
          )}

          {/* ── Image direction CTA ── */}
          <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-4">
            <p className="text-xs font-bold text-indigo-800 mb-1">📸 画像ディレクション（メイン）</p>
            <p className="text-[11px] text-indigo-700 leading-relaxed mb-3">
              参考画像をアップロードして ChatGPT 用の指示文を生成するには、
              上部の「<strong>📸 画像</strong>」タブをご利用ください。
              雰囲気・構図・色味を活かしたオリジナル画像が作れます。
            </p>
            {imageUrls.length > 0 && (
              <div>
                <p className="text-[10px] text-indigo-600 font-semibold mb-1.5">
                  参考LPから {imageUrls.length} 枚の画像を検出しました：
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {imageUrls.slice(0, 5).map((url, i) => (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      key={i}
                      src={url}
                      alt={`参考画像 ${i + 1}`}
                      className="w-12 h-9 object-cover rounded-md border border-indigo-200"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Image tone analysis section（サブ機能） ── */}
          {imageUrls.length > 0 && (
            <details className="rounded-lg border border-gray-200 overflow-hidden group">
              <summary className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200 cursor-pointer list-none">
                <div>
                  <p className="text-xs font-bold text-gray-700">🔍 参考LP画像のトーン分析（詳細）</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    参考LPから {imageUrls.length} 枚の画像を構図・色味・雰囲気の観点でAI分析します
                  </p>
                </div>
                <span className="text-gray-400 text-xs shrink-0 ml-2">▾</span>
              </summary>

              <div className="p-3 space-y-3">
                {!imageAnalyzed && !imageAnalyzing && (
                  <button
                    onClick={handleAnalyzeImages}
                    disabled={imageAnalyzing}
                    className="w-full py-2 px-3 text-xs font-semibold bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                  >
                    Claude Vision で画像を分析する
                  </button>
                )}

                {imageAnalyzing && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div className="w-3 h-3 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin shrink-0" />
                    Claude Vision で各画像を順番に分析しています…（1〜2分）
                  </div>
                )}

                {imageError && (
                  <div className="text-xs text-red-600">{imageError}</div>
                )}

                {imageAnalyses.length > 0 && (
                  <>
                    <div className="space-y-3">
                      {imageAnalyses.map((img, i) => (
                        <ImageCard key={img.url} img={img} index={i} />
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-400 text-center">
                      ⚠ 参考画像をコピーするのではなく、雰囲気・構図・色味を参考にしたオリジナル画像を作成してください
                    </p>
                  </>
                )}

                {imageAnalyzed && (
                  <span className="text-xs text-green-600 font-semibold">✓ 分析完了</span>
                )}
              </div>
            </details>
          )}

          {/* Notes */}
          {analysis.notes && (
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              📝 {analysis.notes}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
              <strong>エラー：</strong>{error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleGenerate}
              className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 transition-all shadow-sm"
            >
              ✨ この構成でLPを生成する
            </button>
            <button
              onClick={() => { setPhase("input"); setAnalysis(null); setSections([]); setProblemLayout("normal"); setImageUrls([]); setImageAnalyses([]); setImageAnalyzed(false); setError(null); }}
              className="w-full py-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              URLを変更してやり直す
            </button>
          </div>
        </div>
      )}

      {/* ── Generating phase ── */}
      {phase === "generating" && (
        <div className="flex flex-col items-center gap-3 py-8">
          <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-600 text-center">参考LP構成をもとにLP生成中…（30〜60秒）</p>
          {retryMsg && <p className="text-xs text-amber-600">{retryMsg}</p>}
        </div>
      )}
    </div>
  );
}
