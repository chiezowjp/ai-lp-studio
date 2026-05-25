"use client";

import { useState, useRef, useCallback } from "react";
import { LPFormData } from "@/types";
import { useAuth } from "@/lib/auth-context";

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "hero",        label: "ファーストビュー", icon: "🏞" },
  { id: "service",     label: "サービス紹介",     icon: "✨" },
  { id: "cta",         label: "CTA背景",          icon: "📣" },
  { id: "testimonial", label: "お客様の声",        icon: "💬" },
  { id: "gallery",     label: "ギャラリー",        icon: "🖼" },
];

const MEMO_FIELDS = [
  {
    key: "whatToReference" as const,
    label: "参考にしたい点",
    placeholder: "例：左側の余白の使い方、全体の柔らかい雰囲気",
  },
  {
    key: "whatToChange" as const,
    label: "変えたい点",
    placeholder: "例：人物は日本人に、背景はホワイト系に",
  },
  {
    key: "elementsToAdd" as const,
    label: "入れたい要素",
    placeholder: "例：観葉植物、ナチュラルな小物、笑顔の女性",
  },
  {
    key: "elementsToAvoid" as const,
    label: "避けたい要素",
    placeholder: "例：人物なし、派手な色、英語テキスト",
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface MemoState {
  whatToReference: string;
  whatToChange: string;
  elementsToAdd: string;
  elementsToAvoid: string;
}

interface GeneratedEntry {
  id: string;
  imageDataUrl: string;
  section: string;
  sectionLabel: string;
  instruction: string;
  timestamp: string;
}

interface Props {
  serviceInfo?: Partial<LPFormData>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        });
      }}
      className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors
        border-gray-200 text-gray-500 hover:border-indigo-400 hover:text-indigo-600 bg-white"
    >
      {copied ? "✓ コピー済み" : "📋 コピー"}
    </button>
  );
}

const inp =
  "w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition";

// ─── Result card ─────────────────────────────────────────────────────────────

function ResultCard({ entry }: { entry: GeneratedEntry }) {
  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 border-b border-gray-100 bg-gray-50">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.imageDataUrl}
          alt="参考画像"
          className="w-16 h-11 object-cover rounded-lg border border-gray-200 shrink-0"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-800">{entry.sectionLabel}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">{entry.timestamp}</p>
        </div>
      </div>

      {/* How to use */}
      <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
        <p className="text-[10px] text-blue-800 leading-relaxed">
          💡 <strong>ChatGPT</strong> で参考画像を添付しながら、下の指示文をそのまま貼り付けてください。
        </p>
      </div>

      {/* Instruction */}
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-wide">ChatGPT 指示文</span>
          <CopyButton text={entry.instruction} />
        </div>
        <p className="text-xs text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-3 border border-gray-100">
          {entry.instruction}
        </p>
      </div>

      {/* LP upload CTA */}
      <div className="px-3 py-2 bg-indigo-50 border-t border-indigo-100">
        <p className="text-[10px] text-indigo-700">
          📤 生成した画像は、LP生成後に左パネルの「画像」アコーディオンからアップロードしてLPに反映できます。
        </p>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ImageDirector({ serviceInfo }: Props) {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  // Upload state
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("image/jpeg");
  const [isDragOver, setIsDragOver] = useState(false);

  // Form state
  const [section, setSection] = useState("hero");
  const [memo, setMemo] = useState<MemoState>({
    whatToReference: "",
    whatToChange: "",
    elementsToAdd: "",
    elementsToAvoid: "",
  });
  const setMemoField = (key: keyof MemoState) =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setMemo((prev) => ({ ...prev, [key]: e.target.value }));

  // Result state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<GeneratedEntry[]>([]);

  // ─── File handling ─────────────────────────────────────────────────────────

  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("画像ファイル（JPG / PNG / WebP）を選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("画像サイズは 5MB 以下にしてください");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const base64 = dataUrl.split(",")[1];
      setImageDataUrl(dataUrl);
      setImageBase64(base64);
      setMimeType(file.type);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

  // ─── Generate ──────────────────────────────────────────────────────────────

  const handleGenerate = async () => {
    if (!imageBase64) {
      setError("参考画像をアップロードしてください");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate-image-direction", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          imageBase64,
          mimeType,
          section,
          ...memo,
          serviceName: serviceInfo?.serviceName ?? "",
          industry: serviceInfo?.industry ?? "",
          serviceDetail: serviceInfo?.serviceDetail ?? "",
          target: serviceInfo?.target ?? "",
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成に失敗しました");

      const sectionData = SECTIONS.find((s) => s.id === section);
      setResults((prev) => [
        {
          id: crypto.randomUUID(),
          imageDataUrl: imageDataUrl!,
          section,
          sectionLabel: sectionData ? `${sectionData.icon} ${sectionData.label}` : section,
          instruction: json.instruction as string,
          timestamp: new Date().toLocaleTimeString("ja-JP", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
        ...prev,
      ]);

      // Reset memo for next use (keep section + image)
      setMemo({ whatToReference: "", whatToChange: "", elementsToAdd: "", elementsToAvoid: "" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">

      {/* Intro banner */}
      <div className="rounded-xl bg-gradient-to-br from-indigo-50 to-purple-50 border border-indigo-200 p-4">
        <p className="text-xs font-bold text-indigo-800 mb-1">📸 画像ディレクション</p>
        <p className="text-[11px] text-indigo-700 leading-relaxed">
          参考画像をアップロードし、ChatGPTなどの画像生成AIへ渡す<strong>指示文を自動生成</strong>します。
          参考画像を添付しながら指示文を貼り付けるだけで、雰囲気・構図・色味を活かしたオリジナル画像が作れます。
        </p>
      </div>

      {/* Service info badge */}
      {(serviceInfo?.serviceName || serviceInfo?.industry) && (
        <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
          <span>🏢</span>
          <span className="font-semibold">{serviceInfo.serviceName}</span>
          {serviceInfo.industry && <span className="text-gray-400">（{serviceInfo.industry}）</span>}
        </div>
      )}

      {/* ① Image upload */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">
          ① 参考画像をアップロード
        </label>

        {imageDataUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="参考画像"
              className="w-full h-40 object-cover rounded-xl border border-gray-200"
            />
            <button
              onClick={() => {
                setImageDataUrl(null);
                setImageBase64(null);
              }}
              className="absolute top-2 right-2 w-7 h-7 bg-white/90 hover:bg-white text-gray-600 hover:text-red-500 rounded-full text-sm font-bold shadow transition-colors flex items-center justify-center"
            >
              ×
            </button>
            <div className="absolute bottom-2 left-2">
              <button
                onClick={() => fileRef.current?.click()}
                className="text-[10px] px-2 py-1 bg-white/90 hover:bg-white text-gray-600 rounded-lg shadow transition-colors font-medium"
              >
                画像を変更
              </button>
            </div>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onClick={() => fileRef.current?.click()}
            className={`w-full h-36 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
              isDragOver
                ? "border-indigo-500 bg-indigo-50 scale-[0.99]"
                : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
            }`}
          >
            <span className="text-3xl mb-2">🖼️</span>
            <p className="text-xs font-semibold text-gray-500">クリックまたはドラッグ＆ドロップ</p>
            <p className="text-[10px] text-gray-400 mt-0.5">JPG / PNG / WebP（5MB 以下）</p>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
            e.target.value = "";
          }}
        />
      </div>

      {/* ② Section selector */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-2">
          ② 使用するセクション
        </label>
        <div className="grid grid-cols-3 gap-1.5">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className={`py-2.5 px-1 rounded-xl text-[11px] font-semibold transition-all flex flex-col items-center gap-1 ${
                section === s.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              <span className="text-lg leading-none">{s.icon}</span>
              <span className="leading-tight text-center">{s.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ③ Direction memo */}
      <div>
        <label className="block text-xs font-bold text-gray-700 mb-1">
          ③ ディレクションメモ
          <span className="ml-1 text-[10px] font-normal text-gray-400">（省略可）</span>
        </label>
        <p className="text-[10px] text-gray-400 mb-2.5">
          指示文に反映させたい要望を入力してください。空白でも自動生成されます。
        </p>
        <div className="space-y-2">
          {MEMO_FIELDS.map(({ key, label, placeholder }) => (
            <div key={key}>
              <p className="text-[10px] text-gray-500 mb-1 font-medium">{label}</p>
              <input
                className={inp}
                value={memo[key]}
                onChange={setMemoField(key)}
                placeholder={placeholder}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
          ⚠ {error}
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={!imageBase64 || loading}
        className="w-full py-3.5 rounded-xl font-bold text-white text-sm bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            指示文を生成中…
          </>
        ) : (
          "✨ ChatGPT 指示文を生成する"
        )}
      </button>

      {/* Workflow note */}
      <div className="text-[10px] text-gray-400 leading-relaxed">
        <p className="font-semibold text-gray-500 mb-0.5">使い方の流れ</p>
        <ol className="space-y-0.5 list-decimal pl-4">
          <li>参考画像をアップロード → 指示文を生成</li>
          <li>ChatGPT を開き、参考画像を添付してから指示文を貼り付け</li>
          <li>生成された画像をダウンロード</li>
          <li>LP生成後、「画像」アコーディオンからアップロードしてLPに反映</li>
        </ol>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400 shrink-0 font-semibold">
              生成した指示文（{results.length}件）
            </span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          {results.map((entry) => (
            <ResultCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}
