"use client";

import { useState } from "react";
import { SelectedElement, StyleRule } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rgbToHex(rgb: string): string {
  if (!rgb) return "#000000";
  if (rgb.startsWith("#")) return rgb.slice(0, 7);
  const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return "#000000";
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => parseInt(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

function px(val: string | undefined, fallback = 0): number {
  return parseFloat(val ?? "") || fallback;
}

// ─── Shared Controls ─────────────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 min-h-7">
      <span className="text-xs text-gray-500 shrink-0 w-[72px] leading-tight">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

function ColorInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const hex = rgbToHex(value || "#ffffff");
  return (
    <Row label={label}>
      <div className="flex items-center gap-1.5">
        <label
          className="w-7 h-7 rounded-md border border-gray-300 cursor-pointer shrink-0 overflow-hidden"
          style={{ backgroundColor: hex }}
        >
          <input
            type="color"
            value={hex}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 w-full h-full cursor-pointer"
          />
        </label>
        <input
          type="text"
          value={hex}
          onChange={(e) => {
            const v = e.target.value;
            if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
          }}
          className="flex-1 text-xs font-mono border border-gray-200 rounded px-2 py-1 min-w-0"
          maxLength={7}
        />
      </div>
    </Row>
  );
}

function SliderInput({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "px",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500 shrink-0">{label}</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-14 text-xs border border-gray-200 rounded px-1.5 py-0.5 text-right"
          />
          <span className="text-[10px] text-gray-400 shrink-0">{unit}</span>
        </div>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-indigo-600 h-1.5"
      />
    </div>
  );
}

function SelectInput({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 bg-white"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Row>
  );
}

function AlignButtons({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const opts = [
    { v: "left", icon: "≡", title: "左寄せ" },
    { v: "center", icon: "≡", title: "中央" },
    { v: "right", icon: "≡", title: "右寄せ" },
  ];
  return (
    <Row label="テキスト配置">
      <div className="flex gap-1">
        {opts.map((o, i) => (
          <button
            key={o.v}
            title={o.title}
            onClick={() => onChange(o.v)}
            className={`flex-1 py-1.5 text-xs rounded border transition-colors font-bold ${
              value === o.v
                ? "bg-indigo-600 text-white border-indigo-600"
                : "border-gray-200 text-gray-500 hover:border-indigo-400"
            }`}
          >
            {["左", "中", "右"][i]}
          </button>
        ))}
      </div>
    </Row>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">
        {label}
      </span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

// ─── Element-specific panels ──────────────────────────────────────────────────

type Upd = (styles: Record<string, string>) => void;

function HeadingPanel({
  s,
  cs,
  upd,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
}) {
  return (
    <div className="space-y-4">
      <SliderInput
        label="フォントサイズ"
        value={px(s.fontSize || cs.fontSize, 24)}
        min={12}
        max={80}
        onChange={(v) => upd({ fontSize: v + "px" })}
      />
      <SelectInput
        label="太さ"
        value={s.fontWeight || cs.fontWeight || "700"}
        onChange={(v) => upd({ fontWeight: v })}
        options={[
          { value: "300", label: "細い (300)" },
          { value: "400", label: "普通 (400)" },
          { value: "500", label: "中 (500)" },
          { value: "600", label: "やや太 (600)" },
          { value: "700", label: "太い (700)" },
          { value: "900", label: "超太 (900)" },
        ]}
      />
      <SliderInput
        label="行間"
        value={parseFloat(s.lineHeight || "1.5")}
        min={1}
        max={3}
        step={0.05}
        unit="×"
        onChange={(v) => upd({ lineHeight: String(v) })}
      />
      <SliderInput
        label="文字間隔"
        value={px(s.letterSpacing || cs.letterSpacing, 0)}
        min={-2}
        max={12}
        step={0.5}
        onChange={(v) => upd({ letterSpacing: v + "px" })}
      />
      <ColorInput
        label="文字色"
        value={s.color || cs.color || "#000000"}
        onChange={(v) => upd({ color: v })}
      />
      <AlignButtons
        value={s.textAlign || cs.textAlign || "left"}
        onChange={(v) => upd({ textAlign: v })}
      />
      <SelectInput
        label="テキスト影"
        value={s.textShadow || "none"}
        onChange={(v) => upd({ textShadow: v })}
        options={[
          { value: "none", label: "なし" },
          { value: "1px 1px 3px rgba(0,0,0,.25)", label: "軽い影" },
          { value: "2px 2px 8px rgba(0,0,0,.45)", label: "濃い影" },
          { value: "0 0 12px rgba(255,255,255,.9)", label: "白グロー" },
          { value: "0 0 12px rgba(99,102,241,.7)", label: "インディゴグロー" },
        ]}
      />
    </div>
  );
}

function TextPanel({
  s,
  cs,
  upd,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
}) {
  return (
    <div className="space-y-4">
      <SliderInput
        label="フォントサイズ"
        value={px(s.fontSize || cs.fontSize, 16)}
        min={10}
        max={32}
        onChange={(v) => upd({ fontSize: v + "px" })}
      />
      <SliderInput
        label="行間"
        value={parseFloat(s.lineHeight || "1.8")}
        min={1}
        max={3}
        step={0.05}
        unit="×"
        onChange={(v) => upd({ lineHeight: String(v) })}
      />
      <SelectInput
        label="最大幅"
        value={s.maxWidth || "none"}
        onChange={(v) => upd({ maxWidth: v })}
        options={[
          { value: "none", label: "制限なし" },
          { value: "560px", label: "560px" },
          { value: "640px", label: "640px" },
          { value: "720px", label: "720px" },
          { value: "800px", label: "800px" },
        ]}
      />
      <ColorInput
        label="文字色"
        value={s.color || cs.color || "#333333"}
        onChange={(v) => upd({ color: v })}
      />
      <AlignButtons
        value={s.textAlign || cs.textAlign || "left"}
        onChange={(v) => upd({ textAlign: v })}
      />
    </div>
  );
}

function SectionPanel({
  s,
  cs,
  upd,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
}) {
  return (
    <div className="space-y-4">
      <ColorInput
        label="背景色"
        value={s.backgroundColor || cs.backgroundColor || "#ffffff"}
        onChange={(v) => upd({ backgroundColor: v })}
      />
      <Divider label="余白" />
      <SliderInput
        label="上余白"
        value={px(s.paddingTop || cs.paddingTop, 80)}
        min={0}
        max={200}
        step={4}
        onChange={(v) => upd({ paddingTop: v + "px" })}
      />
      <SliderInput
        label="下余白"
        value={px(s.paddingBottom || cs.paddingBottom, 80)}
        min={0}
        max={200}
        step={4}
        onChange={(v) => upd({ paddingBottom: v + "px" })}
      />
      <Divider label="形状" />
      <SelectInput
        label="最大幅"
        value={s.maxWidth || "none"}
        onChange={(v) => upd({ maxWidth: v })}
        options={[
          { value: "none", label: "制限なし" },
          { value: "960px", label: "960px" },
          { value: "1080px", label: "1080px" },
          { value: "1200px", label: "1200px" },
          { value: "1400px", label: "1400px" },
        ]}
      />
      <SliderInput
        label="角丸"
        value={px(s.borderRadius, 0)}
        min={0}
        max={32}
        onChange={(v) => upd({ borderRadius: v + "px" })}
      />
    </div>
  );
}

function ImagePanel({
  s,
  cs,
  upd,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
}) {
  return (
    <div className="space-y-4">
      <SelectInput
        label="横幅"
        value={s.width || "100%"}
        onChange={(v) => upd({ width: v })}
        options={[
          { value: "100%", label: "100%（横幅いっぱい）" },
          { value: "80%", label: "80%" },
          { value: "640px", label: "640px" },
          { value: "480px", label: "480px" },
          { value: "auto", label: "自動" },
        ]}
      />
      <SliderInput
        label="角丸"
        value={px(s.borderRadius, 0)}
        min={0}
        max={50}
        onChange={(v) => upd({ borderRadius: v + "px" })}
      />
      <SelectInput
        label="フィット"
        value={s.objectFit || "cover"}
        onChange={(v) => upd({ objectFit: v })}
        options={[
          { value: "cover", label: "カバー（トリミング）" },
          { value: "contain", label: "コンテイン（全体表示）" },
          { value: "fill", label: "引き伸ばし" },
        ]}
      />
      <SelectInput
        label="枠線"
        value={s.outline || "none"}
        onChange={(v) => upd({ outline: v })}
        options={[
          { value: "none", label: "なし" },
          { value: "2px solid #e5e7eb", label: "細いグレー" },
          { value: "3px solid #6366f1", label: "インディゴ" },
          { value: "3px solid #f59e0b", label: "ゴールド" },
        ]}
      />
    </div>
  );
}

// ─── Button Panel (4 tabs) ────────────────────────────────────────────────────

type BtnTab = "design" | "size" | "align" | "motion";

const SHADOW_OPTIONS = [
  { value: "none", label: "なし" },
  { value: "0 2px 6px rgba(0,0,0,.15)", label: "小（さりげない）" },
  { value: "0 4px 14px rgba(0,0,0,.2)", label: "中（標準）" },
  { value: "0 8px 24px rgba(0,0,0,.25)", label: "大（浮遊感）" },
  { value: "0 4px 18px rgba(99,102,241,.45)", label: "光彩（インディゴ）" },
  { value: "0 4px 18px rgba(236,72,153,.45)", label: "光彩（ピンク）" },
  { value: "0 4px 18px rgba(245,158,11,.45)", label: "光彩（ゴールド）" },
  { value: "0 4px 18px rgba(16,185,129,.45)", label: "光彩（グリーン）" },
];

const BORDER_OPTIONS = [
  { value: "none", label: "なし" },
  { value: "2px solid #ffffff", label: "白枠" },
  { value: "2px solid currentColor", label: "文字色と同色" },
  { value: "2px solid #6366f1", label: "インディゴ" },
  { value: "2px solid #000000", label: "黒" },
  { value: "2px solid #e5e7eb", label: "薄いグレー" },
];

function ButtonPanel({
  rule,
  cs,
  onUpdate,
}: {
  rule: StyleRule;
  cs: Record<string, string>;
  onUpdate: (partial: Partial<StyleRule>) => void;
}) {
  const [tab, setTab] = useState<BtnTab>("design");
  const s = rule.styles ?? {};
  const h = rule.hoverStyles ?? {};

  const upd = (add: Record<string, string>) =>
    onUpdate({ styles: { ...s, ...add } });
  const updHover = (add: Record<string, string>) =>
    onUpdate({ hoverStyles: { ...h, ...add } });

  const TABS: { id: BtnTab; label: string }[] = [
    { id: "design", label: "デザイン" },
    { id: "size", label: "サイズ" },
    { id: "align", label: "配置" },
    { id: "motion", label: "動き" },
  ];

  return (
    <div className="space-y-3">
      {/* Sub-tabs */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-[11px] font-semibold transition-colors ${
              tab === t.id
                ? "bg-indigo-600 text-white"
                : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── デザイン tab ── */}
      {tab === "design" && (
        <div className="space-y-4">
          <ColorInput
            label="背景色"
            value={s.backgroundColor || cs.backgroundColor || "#6366f1"}
            onChange={(v) => upd({ backgroundColor: v })}
          />
          <ColorInput
            label="文字色"
            value={s.color || cs.color || "#ffffff"}
            onChange={(v) => upd({ color: v })}
          />
          <SliderInput
            label="角丸"
            value={px(s.borderRadius || cs.borderRadius, 8)}
            min={0}
            max={50}
            onChange={(v) => upd({ borderRadius: v + "px" })}
          />
          <SelectInput
            label="シャドウ"
            value={s.boxShadow || "none"}
            onChange={(v) => upd({ boxShadow: v })}
            options={SHADOW_OPTIONS}
          />
          <SelectInput
            label="枠線"
            value={s.border || "none"}
            onChange={(v) => upd({ border: v })}
            options={BORDER_OPTIONS}
          />
          <Divider label="ホバー時" />
          <ColorInput
            label="ホバー背景"
            value={h.backgroundColor || s.backgroundColor || cs.backgroundColor || "#4f46e5"}
            onChange={(v) => updHover({ backgroundColor: v })}
          />
          <ColorInput
            label="ホバー文字"
            value={h.color || s.color || cs.color || "#ffffff"}
            onChange={(v) => updHover({ color: v })}
          />
        </div>
      )}

      {/* ── サイズ tab ── */}
      {tab === "size" && (
        <div className="space-y-4">
          <SliderInput
            label="文字サイズ"
            value={px(s.fontSize || cs.fontSize, 16)}
            min={10}
            max={28}
            onChange={(v) => upd({ fontSize: v + "px" })}
          />
          <SliderInput
            label="上下 padding"
            value={px(s.paddingTop || cs.paddingTop, 12)}
            min={4}
            max={40}
            onChange={(v) => upd({ paddingTop: v + "px", paddingBottom: v + "px" })}
          />
          <SliderInput
            label="左右 padding"
            value={px(s.paddingLeft || cs.paddingLeft, 24)}
            min={8}
            max={80}
            onChange={(v) => upd({ paddingLeft: v + "px", paddingRight: v + "px" })}
          />
          <SelectInput
            label="横幅"
            value={s.width || "auto"}
            onChange={(v) => upd({ width: v })}
            options={[
              { value: "auto", label: "自動（テキストに合わせる）" },
              { value: "180px", label: "180px" },
              { value: "240px", label: "240px" },
              { value: "320px", label: "320px" },
              { value: "400px", label: "400px" },
              { value: "100%", label: "100%（横幅いっぱい）" },
            ]}
          />
          <SelectInput
            label="高さ"
            value={s.minHeight || "auto"}
            onChange={(v) => upd({ minHeight: v })}
            options={[
              { value: "auto", label: "自動" },
              { value: "44px", label: "44px（スマホ標準）" },
              { value: "52px", label: "52px" },
              { value: "60px", label: "60px（大きめ）" },
              { value: "72px", label: "72px（特大）" },
            ]}
          />
        </div>
      )}

      {/* ── 配置 tab ── */}
      {tab === "align" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-2">ボタンの配置</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { label: "← 左寄せ",   apply: { display: "inline-block", marginLeft: "0",    marginRight: "auto",  width: "",     textAlign: "" } },
                  { label: "中央",        apply: { display: "block",        marginLeft: "auto",  marginRight: "auto",  width: s.width || "auto", textAlign: "center" } },
                  { label: "右寄せ →",   apply: { display: "inline-block", marginLeft: "auto",  marginRight: "0",     width: "",     textAlign: "" } },
                  { label: "↔ 横幅いっぱい", apply: { display: "block",   marginLeft: "0",    marginRight: "0",     width: "100%", textAlign: "center" } },
                ] as { label: string; apply: Record<string, string> }[]
              ).map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => upd(opt.apply)}
                  className="py-2.5 text-xs border border-gray-200 rounded-lg hover:border-indigo-400 hover:text-indigo-600 transition-colors font-medium"
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <Divider label="スマホ対応" />
          <label className="flex items-center gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={rule.mobileFullWidth || false}
              onChange={(e) => onUpdate({ mobileFullWidth: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded"
            />
            <div>
              <p className="text-xs font-semibold text-gray-700">スマホで横幅いっぱい</p>
              <p className="text-[10px] text-gray-400">640px以下で自動的にwidthを100%に</p>
            </div>
          </label>
        </div>
      )}

      {/* ── 動き tab ── */}
      {tab === "motion" && (
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500 mb-3">ホバーアニメーション</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { v: "none", label: "なし", desc: "アニメなし" },
                { v: "lift", label: "🆙 浮く", desc: "hover時に上に浮く" },
                { v: "scale", label: "🔍 拡大", desc: "hover時に少し拡大" },
                { v: "pulse", label: "✨ 点滅", desc: "常時ゆっくり点滅" },
              ].map((opt) => (
                <button
                  key={opt.v}
                  onClick={() => onUpdate({ animation: opt.v as StyleRule["animation"] })}
                  title={opt.desc}
                  className={`py-3 text-xs rounded-lg border font-medium transition-colors flex flex-col items-center gap-1 ${
                    rule.animation === opt.v
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 text-gray-600 hover:border-indigo-400"
                  }`}
                >
                  <span className="text-base leading-none">{opt.label.split(" ")[0]}</span>
                  <span className="text-[10px] opacity-80">{opt.label.split(" ").slice(1).join(" ") || "なし"}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 mt-3">
              「浮く」「拡大」はホバー時のみ動作。「点滅」は常時動作（CTAを目立たせたい時に）。
            </p>
          </div>
          <Divider label="遷移速度" />
          <SelectInput
            label="速度"
            value={s.transitionDuration || "0.25s"}
            onChange={(v) => upd({ transitionDuration: v })}
            options={[
              { value: "0.15s", label: "速い (150ms)" },
              { value: "0.25s", label: "標準 (250ms)" },
              { value: "0.4s", label: "ゆっくり (400ms)" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

// ─── Main VisualStylePanel ────────────────────────────────────────────────────

interface Props {
  element: SelectedElement;
  currentRule: StyleRule;
  onUpdate: (selector: string, rule: StyleRule) => void;
  onDeselect: () => void;
}

const TYPE_ICONS: Record<string, string> = {
  heading: "H",
  text: "¶",
  button: "▶",
  section: "▣",
  image: "⬜",
};

const TYPE_LABELS: Record<string, string> = {
  heading: "見出し",
  text: "本文",
  button: "ボタン",
  section: "セクション",
  image: "画像",
};

export default function VisualStylePanel({
  element,
  currentRule,
  onUpdate,
  onDeselect,
}: Props) {
  const s = currentRule?.styles ?? {};
  const cs = element.computedStyles;

  const upd = (add: Record<string, string>) =>
    onUpdate(element.selector, {
      ...currentRule,
      styles: { ...s, ...add },
    });

  const updRule = (partial: Partial<StyleRule>) =>
    onUpdate(element.selector, { ...currentRule, ...partial });

  const handleReset = () =>
    onUpdate(element.selector, {
      styles: {},
      hoverStyles: {},
      animation: "none",
      mobileFullWidth: false,
    });

  const hasOverrides =
    Object.keys(s).length > 0 ||
    Object.keys(currentRule?.hoverStyles ?? {}).length > 0 ||
    (currentRule?.animation && currentRule.animation !== "none") ||
    currentRule?.mobileFullWidth;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
        <span className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0">
          {TYPE_ICONS[element.type]}
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-gray-900">
            {TYPE_LABELS[element.type]}を編集
          </p>
          <p className="text-[10px] text-gray-400 font-mono truncate">
            {element.selector}
          </p>
        </div>
        <button
          onClick={onDeselect}
          className="w-7 h-7 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors flex items-center justify-center text-lg leading-none shrink-0"
        >
          ×
        </button>
      </div>

      {/* Controls (scrollable) */}
      <div className="flex-1 overflow-y-auto p-4">
        {element.type === "heading" && (
          <HeadingPanel s={s} cs={cs} upd={upd} />
        )}
        {element.type === "text" && <TextPanel s={s} cs={cs} upd={upd} />}
        {element.type === "button" && (
          <ButtonPanel rule={currentRule} cs={cs} onUpdate={updRule} />
        )}
        {element.type === "section" && (
          <SectionPanel s={s} cs={cs} upd={upd} />
        )}
        {element.type === "image" && <ImagePanel s={s} cs={cs} upd={upd} />}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0 space-y-2">
        {hasOverrides && (
          <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
            スタイル変更済み
          </div>
        )}
        <button
          onClick={handleReset}
          className="w-full py-2 text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
        >
          このスタイルをリセット
        </button>
      </div>
    </div>
  );
}
