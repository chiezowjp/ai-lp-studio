"use client";

import { useState, useRef, useCallback } from "react";
import { UploadedImage, LPFormData, UnsplashResult } from "@/types";
import { useAuth } from "@/lib/auth-context";
import UnsplashPicker from "./UnsplashPicker";

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionTab = "direction" | "upload" | "unsplash";

interface Props {
  sectionOrder: { id: string; label: string }[];
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
  unsplashResult: UnsplashResult | null;
  unsplashLoading: boolean;
  unsplashError: string | null;
  onUnsplashFetch: () => void;
  onImageSelect: (image: UploadedImage) => void;
  onImageDeselect: (placement: string) => void;
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
      className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold rounded-lg border transition-colors
        border-gray-200 text-gray-500 hover:border-[#00AFCC] hover:text-[#00AFCC] bg-white"
    >
      {copied ? "✓ コピー済" : "📋 コピー"}
    </button>
  );
}

// ─── Direction panel（ChatGPT 指示文生成） ────────────────────────────────────

function DirectionPanel({
  sectionId,
  sectionLabel,
  serviceInfo,
}: {
  sectionId: string;
  sectionLabel: string;
  serviceInfo?: Partial<LPFormData>;
}) {
  const { session } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMemo, setShowMemo] = useState(false);
  const [whatToReference, setWhatToReference] = useState("");
  const [whatToChange, setWhatToChange] = useState("");
  const [elementsToAdd, setElementsToAdd] = useState("");
  const [elementsToAvoid, setElementsToAvoid] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [resultImageDataUrl, setResultImageDataUrl] = useState<string | null>(null);

  const handleFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("画像ファイルを選択してください");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("5MB 以下の画像を選択してください");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setImageDataUrl(dataUrl);
      setImageBase64(dataUrl.split(",")[1]);
      setMimeType(file.type);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleGenerate = async () => {
    if (!imageBase64) { setError("参考画像をアップロードしてください"); return; }
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
          imageBase64, mimeType, section: sectionId,
          whatToReference, whatToChange, elementsToAdd, elementsToAvoid,
          serviceName: serviceInfo?.serviceName ?? "",
          industry: serviceInfo?.industry ?? "",
          serviceDetail: serviceInfo?.serviceDetail ?? "",
          target: serviceInfo?.target ?? "",
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "生成に失敗しました");
      setResult(json.instruction as string);
      setResultImageDataUrl(imageDataUrl);
      setWhatToReference(""); setWhatToChange(""); setElementsToAdd(""); setElementsToAvoid("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成に失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const inp = "w-full rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#00AFCC] focus:border-transparent transition";

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500 leading-relaxed">
        参考にしたい画像をアップロードすると、<strong>ChatGPT 用の画像生成指示文</strong>を自動作成します。
      </p>

      {/* 参考画像アップロード */}
      {imageDataUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageDataUrl} alt="参考画像" className="w-full h-28 object-cover rounded-xl border border-gray-200" />
          <button
            onClick={() => { setImageDataUrl(null); setImageBase64(null); setResult(null); setResultImageDataUrl(null); }}
            className="absolute top-1.5 right-1.5 w-6 h-6 bg-white/90 hover:bg-white text-gray-500 hover:text-red-500 rounded-full text-xs font-bold shadow transition-colors flex items-center justify-center"
          >×</button>
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute bottom-1.5 left-1.5 text-[10px] px-2 py-1 bg-white/90 hover:bg-white text-gray-600 rounded-lg shadow font-medium transition-colors"
          >画像を変更</button>
        </div>
      ) : (
        <div
          onDrop={(e) => { e.preventDefault(); setIsDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onClick={() => fileRef.current?.click()}
          className={`h-24 rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragOver ? "border-[#00AFCC] bg-[#E6F8FC]" : "border-gray-300 hover:border-[#00AFCC] hover:bg-[#E6F8FC]"
          }`}
        >
          <span className="text-2xl mb-1">🖼️</span>
          <p className="text-[11px] text-gray-500 font-medium">参考画像をドロップ or クリック</p>
          <p className="text-[10px] text-gray-400">JPG / PNG / WebP（5MB 以下）</p>
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />

      {/* 詳細メモ（折り畳み） */}
      {imageDataUrl && (
        <button onClick={() => setShowMemo(!showMemo)}
          className="text-[11px] text-[#00AFCC] hover:text-[#0099B3] font-medium transition-colors">
          {showMemo ? "▲ メモを閉じる" : "▼ 詳細を追加（変えたい点など）"}
        </button>
      )}
      {showMemo && (
        <div className="space-y-2 bg-gray-50 rounded-xl p-3 border border-gray-100">
          {[
            { label: "参考にしたい点", value: whatToReference, set: setWhatToReference, placeholder: "余白の使い方、柔らかい雰囲気など" },
            { label: "変えたい点", value: whatToChange, set: setWhatToChange, placeholder: "人物は日本人に、背景は白系に" },
            { label: "入れたい要素", value: elementsToAdd, set: setElementsToAdd, placeholder: "観葉植物、自然な小物など" },
            { label: "避けたい要素", value: elementsToAvoid, set: setElementsToAvoid, placeholder: "人物なし、派手な色を避ける" },
          ].map(({ label, value, set, placeholder }) => (
            <div key={label}>
              <p className="text-[10px] text-gray-500 mb-0.5 font-medium">{label}</p>
              <input className={inp} value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-[11px] text-red-600 bg-red-50 rounded-lg px-3 py-2">⚠ {error}</p>
      )}

      {/* 生成ボタン */}
      <button onClick={handleGenerate} disabled={!imageBase64 || loading}
        className="w-full py-3 rounded-xl font-bold text-white text-xs bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
        {loading ? (
          <><div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />指示文を生成中…</>
        ) : `✨ 「${sectionLabel}」の画像指示文を生成`}
      </button>

      {/* 生成結果 */}
      {result && (
        <div className="rounded-xl border border-[#D8D8D2] overflow-hidden">
          {resultImageDataUrl && (
            <div className="flex items-center gap-2 p-2.5 bg-gray-50 border-b border-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={resultImageDataUrl} alt="参考" className="w-10 h-7 object-cover rounded border border-gray-200 shrink-0" />
              <p className="text-[10px] text-gray-500">{sectionLabel} の画像指示文</p>
            </div>
          )}
          <div className="px-3 py-2 bg-blue-50 border-b border-blue-100">
            <p className="text-[10px] text-blue-800">
              💡 <strong>ChatGPT</strong> で参考画像を添付しながら、下の指示文をそのまま貼り付けてください。
            </p>
          </div>
          <div className="p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] font-bold text-gray-600">ChatGPT 指示文</span>
              <CopyButton text={result} />
            </div>
            <p className="text-[11px] text-gray-800 leading-relaxed whitespace-pre-wrap bg-gray-50 rounded-lg p-2.5 border border-gray-100">
              {result}
            </p>
          </div>
          <div className="px-3 py-2 bg-[#E6F8FC] border-t border-[#D8D8D2]">
            <p className="text-[10px] text-[#00AFCC]">
              📤 生成した画像は「差し替え」タブでアップロードして LP に反映できます。
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Upload panel（直接差し替え） ─────────────────────────────────────────────

function UploadPanel({
  sectionId,
  sectionLabel,
  images,
  onImagesChange,
}: {
  sectionId: string;
  sectionLabel: string;
  images: UploadedImage[];
  onImagesChange: (images: UploadedImage[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const currentImage = images.find((img) => img.placement === sectionId && !img.attribution);

  const handleFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const newImage: UploadedImage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      url,
      name: file.name,
      placement: sectionId,
    };
    // 同セクションの既存ユーザー画像を差し替え
    const others = images.filter((img) => !(img.placement === sectionId && !img.attribution));
    onImagesChange([...others, newImage]);
  };

  const remove = () => {
    if (currentImage) URL.revokeObjectURL(currentImage.url);
    onImagesChange(images.filter((img) => !(img.placement === sectionId && !img.attribution)));
  };

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-gray-500">
        「{sectionLabel}」の背景画像を直接アップロードして差し替えます。
      </p>

      {currentImage ? (
        <div className="space-y-2">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentImage.url} alt={currentImage.name}
              className="w-full h-32 object-cover rounded-xl border border-gray-200" />
            <div className="absolute top-1.5 right-1.5 flex gap-1">
              <button onClick={() => fileRef.current?.click()}
                className="px-2 py-1 bg-white/90 hover:bg-white text-xs font-semibold rounded-lg shadow transition-colors text-gray-700">
                変更
              </button>
              <button onClick={remove}
                className="w-6 h-6 bg-red-500 hover:bg-red-600 text-white text-xs rounded-full flex items-center justify-center shadow transition-colors font-bold">
                ×
              </button>
            </div>
          </div>
          <p className="text-[10px] text-green-600 font-semibold">✓ LP に反映されています</p>
        </div>
      ) : (
        <button type="button" onClick={() => fileRef.current?.click()}
          className="w-full border-2 border-dashed border-gray-300 hover:border-[#00AFCC] hover:bg-[#E6F8FC] rounded-xl py-8 flex flex-col items-center gap-2 text-gray-400 hover:text-[#00AFCC] transition-all">
          <span className="text-3xl">📤</span>
          <span className="text-xs font-semibold">クリックして画像をアップロード</span>
          <span className="text-[10px]">JPG / PNG / WebP</span>
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const FALLBACK_SECTIONS = [{ id: "hero", label: "ファーストビュー" }];

const TABS: { id: SectionTab; label: string; title: string }[] = [
  { id: "direction", label: "🎨 ディレクション", title: "参考画像から ChatGPT 指示文を生成" },
  { id: "upload",    label: "📤 差し替え",       title: "画像を直接アップロードして差し替え" },
  { id: "unsplash",  label: "🔍 Unsplash",       title: "Unsplash から無料画像を選択" },
];

export default function SectionImageManager({
  sectionOrder,
  images,
  onImagesChange,
  unsplashResult,
  unsplashLoading,
  unsplashError,
  onUnsplashFetch,
  onImageSelect,
  onImageDeselect,
  serviceInfo,
}: Props) {
  const { session } = useAuth();
  const sections = sectionOrder.length > 0 ? sectionOrder : FALLBACK_SECTIONS;
  const [selectedId, setSelectedId] = useState(sections[0]?.id ?? "hero");
  const [activeTab, setActiveTab] = useState<SectionTab>("direction");

  const selectedSection = sections.find((s) => s.id === selectedId) ?? sections[0];

  const handleSectionChange = (id: string) => {
    setSelectedId(id);
    setActiveTab("direction");
  };

  return (
    <div className="space-y-3">

      {/* セクション選択（プルダウン） */}
      <div>
        <label className="text-[10px] font-semibold text-gray-500 block mb-1.5">
          改善するセクション
        </label>
        <select
          value={selectedId}
          onChange={(e) => handleSectionChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900
            focus:outline-none focus:ring-2 focus:ring-[#00AFCC] focus:border-transparent transition
            appearance-none cursor-pointer"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center" }}
        >
          {sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {/* セクション見出し */}
      <div className="rounded-xl bg-[#E6F8FC] border border-[#D8D8D2] px-3 py-2.5">
        <p className="text-xs font-bold text-[#222222]">
          「{selectedSection?.label ?? "セクション"}」の画像を改善
        </p>
        <p className="text-[10px] text-[#00AFCC] mt-0.5">
          {TABS.find((t) => t.id === activeTab)?.title}
        </p>
      </div>

      {/* タブバー */}
      <div className="flex rounded-xl border border-gray-200 overflow-hidden">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-[10px] font-semibold transition-colors leading-tight px-1 ${
              activeTab === tab.id
                ? "bg-[#00AFCC] text-white"
                : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* タブコンテンツ */}
      {activeTab === "direction" && (
        <DirectionPanel
          key={selectedId}
          sectionId={selectedId}
          sectionLabel={selectedSection?.label ?? "セクション"}
          serviceInfo={serviceInfo}
        />
      )}

      {activeTab === "upload" && (
        <UploadPanel
          key={selectedId}
          sectionId={selectedId}
          sectionLabel={selectedSection?.label ?? "セクション"}
          images={images}
          onImagesChange={onImagesChange}
        />
      )}

      {activeTab === "unsplash" && (
        <div className="space-y-3">
          <p className="text-[11px] text-gray-500 leading-relaxed">
            Unsplash から高品質な無料画像を選択して LP に反映します。
          </p>
          <button
            onClick={onUnsplashFetch}
            disabled={unsplashLoading}
            className="w-full py-2.5 text-xs font-semibold bg-[#00AFCC] hover:bg-[#0099B3] disabled:opacity-50 text-white rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            {unsplashLoading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                提案中…
              </>
            ) : "🔍 Unsplash で画像を提案"}
          </button>
          {unsplashError && (
            <p className="text-xs text-red-600">{unsplashError}</p>
          )}
          {unsplashResult && (
            <UnsplashPicker
              result={unsplashResult}
              selectedImages={images}
              onSelect={onImageSelect}
              onDeselect={onImageDeselect}
            />
          )}
        </div>
      )}
    </div>
  );
}
