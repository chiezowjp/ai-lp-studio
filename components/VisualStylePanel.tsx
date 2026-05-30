"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { SelectedElement, StyleRule, ButtonImageConfig, OverlayConfig } from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rgbToHex(rgb: string): string {
  if (!rgb) return "#ffffff";
  if (rgb.startsWith("#")) return rgb.slice(0, 7);
  // 末尾の ) が欠けている場合も考慮（STYLE_SELECT_JS が truncate することがある）
  const m = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/);
  if (!m) return "#ffffff";
  // fully transparent → treat as white
  if (m[4] !== undefined && parseFloat(m[4]) === 0) return "#ffffff";
  return (
    "#" +
    [m[1], m[2], m[3]]
      .map((n) => parseInt(n).toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * 極低アルファ rgba（alpha < 0.15）を空文字に変換する。
 * lp-vs-a の rgba(99,102,241,.05) が computedStyles に紛れ込んでも
 * カラーピッカーに誤った色が表示されないようにするための防衛処理。
 */
function sanitizeCsBg(v: string | undefined): string {
  if (!v) return "";
  const m = v.match(/^rgba\s*\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/);
  if (m && parseFloat(m[1]) < 0.15) return "";
  return v;
}

function px(val: string | undefined, fallback = 0): number {
  return parseFloat(val ?? "") || fallback;
}

/** border / borderBottom などの shorthand から太さ(px数値)を取得 */
function parseBorderWidth(v: string | undefined): number {
  if (!v || v === "none") return 0;
  const m = v.match(/(\d+(?:\.\d+)?)px/);
  return m ? parseFloat(m[1]) : 0;
}

/** border / borderBottom などの shorthand または borderColor から色を取得（6文字HEX） */
function parseBorderColor(v: string | undefined, fallback = "#e5e7eb"): string {
  if (!v || v === "none") return fallback;
  const hex6 = v.match(/#[0-9a-fA-F]{6}/);
  if (hex6) return hex6[0].toLowerCase();
  const hex3 = v.match(/#([0-9a-fA-F]{3})\b/);
  if (hex3) {
    const r = hex3[1].toLowerCase();
    return `#${r[0]}${r[0]}${r[1]}${r[1]}${r[2]}${r[2]}`;
  }
  return fallback;
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
        className="w-full accent-[#00AFCC] h-1.5"
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
                ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                : "border-gray-200 text-gray-500 hover:border-[#00AFCC]"
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

// ─── Text Shadow Control ──────────────────────────────────────────────────────

type ShadowType =
  | "none"
  | "black-shadow"
  | "white-glow"
  | "black-glow"
  | "soft-shadow"
  | "strong-shadow";

const SHADOW_TYPES: { id: ShadowType; label: string }[] = [
  { id: "none",          label: "なし" },
  { id: "black-shadow",  label: "黒シャドウ" },
  { id: "white-glow",    label: "白グロー" },
  { id: "black-glow",    label: "黒グロー" },
  { id: "soft-shadow",   label: "ソフト影" },
  { id: "strong-shadow", label: "強シャドウ" },
];

/** type + strength(0-100) + blur(0-50) → CSS text-shadow 文字列 */
function buildTextShadow(type: ShadowType, strength: number, blur: number): string {
  if (type === "none") return "none";
  // clamp
  const s = Math.max(0, Math.min(100, strength));
  const b = Math.max(0, Math.min(50, blur));
  const op  = (s / 100).toFixed(2);
  const op2 = (Math.min(s, 60) / 100).toFixed(2); // secondary shadow は薄め
  switch (type) {
    case "black-shadow":
      return `2px 2px ${b}px rgba(0,0,0,${op})`;
    case "white-glow":
      return `0 0 ${b}px rgba(255,255,255,${op})`;
    case "black-glow":
      return `0 0 ${b}px rgba(0,0,0,${op})`;
    case "soft-shadow":
      return `1px 1px ${b}px rgba(0,0,0,${(s / 200).toFixed(2)})`;
    case "strong-shadow":
      return `2px 2px ${b}px rgba(0,0,0,${op}), 0 0 ${Math.round(b * 1.6)}px rgba(0,0,0,${op2})`;
    default:
      return "none";
  }
}

/** CSS text-shadow 文字列 → type / strength / blur を逆算 */
function parseTextShadow(css: string): { type: ShadowType; strength: number; blur: number } {
  const defaults = { type: "none" as ShadowType, strength: 50, blur: 12 };
  if (!css || css === "none") return defaults;
  try {
    const parts = css.split(/,(?![^(]*\))/); // rgba 内のカンマは無視して分割
    if (parts.length > 1) {
      // strong-shadow
      const blurM = parts[0].match(/\d+px\s+\d+px\s+([\d.]+)px/);
      const opM   = parts[0].match(/rgba?\([^)]+,\s*([\d.]+)\)/);
      return {
        type: "strong-shadow",
        strength: Math.round(parseFloat(opM?.[1] ?? "0.5") * 100),
        blur: parseFloat(blurM?.[1] ?? "12"),
      };
    }
    const shadow = parts[0].trim();
    const tokens = shadow.replace(/,/g, " ").split(/\s+/);
    const xOff = parseFloat(tokens[0]) || 0;
    const yOff = parseFloat(tokens[1]) || 0;
    const blur  = parseFloat(tokens[2]) || 12;
    const rgbaM = shadow.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    const r  = parseInt(rgbaM?.[1] ?? "0");
    const op = parseFloat(rgbaM?.[4] ?? "0.5");
    const isGlow = Math.abs(xOff) < 0.5 && Math.abs(yOff) < 0.5;
    const isWhite = r > 200;
    const isSoft  = Math.abs(xOff) <= 1.5 && !isGlow;
    if (isGlow && isWhite) return { type: "white-glow",   strength: Math.round(op * 100), blur };
    if (isGlow && !isWhite) return { type: "black-glow",  strength: Math.round(op * 100), blur };
    if (isSoft)             return { type: "soft-shadow",  strength: Math.round(op * 200), blur };
    return                         { type: "black-shadow", strength: Math.round(op * 100), blur };
  } catch {
    return defaults;
  }
}

/** 見出し・本文共通 text-shadow スライダーUI */
function TextShadowControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const init = useMemo(() => parseTextShadow(value), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [type, setType]       = useState<ShadowType>(init.type);
  const [strength, setStrength] = useState<number>(init.strength);
  const [blur, setBlur]         = useState<number>(init.blur);

  /** 最後に親へ書き込んだ CSS 文字列（外部変更の検知に使用） */
  const lastWritten = useRef<string>(value);

  // 外部変更（undo など）を検知してローカル状態を同期
  useEffect(() => {
    if (value !== lastWritten.current) {
      lastWritten.current = value;
      const parsed = parseTextShadow(value);
      setType(parsed.type);
      setStrength(parsed.strength);
      setBlur(parsed.blur);
    }
  }, [value]);

  /** ローカル状態変更 → CSS生成 → 親通知 */
  const emit = (t: ShadowType, s: number, b: number) => {
    const css = buildTextShadow(t, s, b);
    lastWritten.current = css;
    onChange(css);
  };

  const handleType = (t: ShadowType) => {
    setType(t);
    // 初期強さ・ぼかしが 0 だと効果が見えないのでデフォルト値を補完
    const s = strength > 0 ? strength : 50;
    const b = blur   > 0 ? blur   : 12;
    if (strength === 0) setStrength(s);
    if (blur === 0)     setBlur(b);
    emit(t, s, b);
  };
  const handleStrength = (v: number) => { setStrength(v); emit(type, v, blur); };
  const handleBlur     = (v: number) => { setBlur(v);     emit(type, strength, v); };

  return (
    <div className="space-y-3">
      {/* タイプ選択 2×3 グリッド */}
      <div className="grid grid-cols-3 gap-1.5">
        {SHADOW_TYPES.map((st) => (
          <button
            key={st.id}
            onClick={() => handleType(st.id)}
            className={`py-2 text-[11px] font-semibold rounded-lg border transition-colors
              ${type === st.id
                ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                : "border-gray-200 text-gray-600 hover:border-[#00AFCC] hover:text-[#00AFCC]"}`}
          >
            {st.label}
          </button>
        ))}
      </div>

      {/* 強さ・ぼかし（影あり時のみ） */}
      {type !== "none" && (
        <>
          <SliderInput
            label="強さ"
            value={strength}
            min={0}
            max={100}
            unit="%"
            onChange={handleStrength}
          />
          <SliderInput
            label="ぼかし"
            value={blur}
            min={0}
            max={50}
            onChange={handleBlur}
          />
        </>
      )}
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
      <Divider label="テキスト影" />
      <TextShadowControl
        value={s.textShadow || "none"}
        onChange={(v) => upd({ textShadow: v })}
      />
      <Divider label="装飾ライン（下線）" />
      {(() => {
        const bw = parseBorderWidth(s.borderBottom || cs.borderBottom);
        const bc = parseBorderColor(s.borderBottom || s.borderColor || cs.borderBottom || cs.borderColor, "#333333");
        return (
          <>
            <SliderInput
              label="下線太さ"
              value={bw}
              min={0}
              max={8}
              onChange={(v) => {
                if (v === 0) {
                  upd({ borderBottom: "none", paddingBottom: "" });
                } else {
                  upd({ borderBottom: `${v}px solid ${bc}`, paddingBottom: "8px" });
                }
              }}
            />
            {bw > 0 && (
              <ColorInput
                label="下線色"
                value={bc}
                onChange={(v) => upd({ borderBottom: `${bw}px solid ${v}` })}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}


// ─── Text background presets ──────────────────────────────────────────────────

const TEXT_BG_PRESETS = [
  { key: "none",    label: "なし",        bg: "transparent",            blur: "none" },
  { key: "white",   label: "半透明白",    bg: "rgba(255,255,255,0.80)", blur: "none" },
  { key: "black",   label: "半透明黒",    bg: "rgba(0,0,0,0.55)",       blur: "none" },
  { key: "frosted", label: "すりガラス",  bg: "rgba(255,255,255,0.20)", blur: "blur(10px)" },
] as const;

type TextBgKey = (typeof TEXT_BG_PRESETS)[number]["key"];

function TextPanel({
  s,
  cs,
  upd,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
}) {
  // 現在の背景プリセットキーを判定（完全一致）
  const activeBgKey: TextBgKey =
    (TEXT_BG_PRESETS.find(
      (p) => p.bg === (s.backgroundColor || "transparent")
    )?.key as TextBgKey) ?? "none";

  const hasBg = activeBgKey !== "none";

  const handleBgSelect = (preset: (typeof TEXT_BG_PRESETS)[number]) => {
    upd({
      backgroundColor: preset.bg,
      backdropFilter: preset.blur,
    });
  };

  return (
    <div className="space-y-4">
      {/* ── レイアウト ── */}
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

      {/* ── テキスト ── */}
      <Divider label="テキスト" />
      <ColorInput
        label="文字色"
        value={s.color || cs.color || "#333333"}
        onChange={(v) => upd({ color: v })}
      />
      {/* 文字色クイック選択 */}
      <Row label="クイック">
        <div className="flex gap-1.5">
          {[
            { label: "白", color: "#ffffff", textCls: "text-gray-500" },
            { label: "黒", color: "#111111", textCls: "text-white" },
          ].map((c) => (
            <button
              key={c.label}
              onClick={() => upd({ color: c.color })}
              title={`文字色を${c.label}に`}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg border-2 transition-colors
                ${s.color === c.color ? "border-[#00AFCC]" : "border-gray-200 hover:border-[#00AFCC]"}`}
              style={{ backgroundColor: c.color, color: c.label === "白" ? "#999" : "#fff" }}
            >
              {c.label}
            </button>
          ))}
        </div>
      </Row>
      <AlignButtons
        value={s.textAlign || cs.textAlign || "left"}
        onChange={(v) => upd({ textAlign: v })}
      />
      <TextShadowControl
        value={s.textShadow || "none"}
        onChange={(v) => upd({ textShadow: v })}
      />

      {/* ── 枠線 ── */}
      <Divider label="枠線" />
      {(() => {
        const bw = parseBorderWidth(s.borderWidth || s.borderBottom || s.border || cs.borderWidth);
        const bc = parseBorderColor(s.borderColor || s.borderBottom || s.border || cs.borderColor);
        return (
          <>
            <SliderInput
              label="枠線太さ"
              value={bw}
              min={0}
              max={8}
              onChange={(v) => {
                if (v === 0) {
                  upd({ borderWidth: "0px", borderStyle: "none" });
                } else {
                  upd({ borderWidth: `${v}px`, borderStyle: "solid", borderColor: bc });
                }
              }}
            />
            {bw > 0 && (
              <ColorInput
                label="枠線色"
                value={bc}
                onChange={(v) => upd({ borderColor: v, borderStyle: "solid" })}
              />
            )}
          </>
        );
      })()}

      {/* ── 文字背景 ── */}
      <Divider label="文字背景" />
      <div>
        <p className="text-[10px] text-gray-400 mb-2 leading-relaxed">
          背景画像の上に文字を重ねる際に有効です
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_BG_PRESETS.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handleBgSelect(preset)}
              className={`py-2.5 text-xs font-semibold rounded-lg border-2 transition-colors
                ${activeBgKey === preset.key
                  ? "border-[#00AFCC] bg-[#E6F8FC] text-[#00AFCC]"
                  : "border-gray-200 text-gray-600 hover:border-[#00AFCC] hover:text-[#00AFCC]"}`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* 背景あり時のみ表示 */}
      {hasBg && (
        <>
          <SliderInput
            label="角丸"
            value={px(s.borderRadius, 0)}
            min={0}
            max={24}
            onChange={(v) => upd({ borderRadius: v + "px" })}
          />
          <SliderInput
            label="上下 padding"
            value={px(s.paddingTop || cs.paddingTop, 8)}
            min={0}
            max={40}
            step={2}
            onChange={(v) =>
              upd({ paddingTop: v + "px", paddingBottom: v + "px" })
            }
          />
          <SliderInput
            label="左右 padding"
            value={px(s.paddingLeft || cs.paddingLeft, 12)}
            min={0}
            max={40}
            step={2}
            onChange={(v) =>
              upd({ paddingLeft: v + "px", paddingRight: v + "px" })
            }
          />
        </>
      )}
    </div>
  );
}

// ─── Background Overlay Panel ─────────────────────────────────────────────────

const OVERLAY_PRESETS: { label: string; color: string; opacity: number; blur: number }[] = [
  { label: "📖 文字を読みやすく", color: "#ffffff", opacity: 30, blur: 0 },
  { label: "🖤 高級感",          color: "#000000", opacity: 25, blur: 0 },
  { label: "🌿 やわらかい",       color: "#f5f0e8", opacity: 30, blur: 0 },
  { label: "🔲 すりガラス",       color: "#ffffff", opacity: 20, blur: 6 },
];

function BackgroundOverlayPanel({
  overlay,
  onUpdate,
}: {
  overlay: OverlayConfig | null | undefined;
  onUpdate: (ov: OverlayConfig) => void;
}) {
  const DEFAULT: OverlayConfig = { enabled: false, color: "#000000", opacity: 30, blur: 0 };
  const ov = overlay ?? DEFAULT;

  const upd = (partial: Partial<OverlayConfig>) => onUpdate({ ...ov, ...partial });

  return (
    <div className="space-y-4">
      {/* ON/OFF */}
      <label className="flex items-center gap-3 cursor-pointer select-none">
        <div
          onClick={() => upd({ enabled: !ov.enabled })}
          className={`w-10 h-5 rounded-full transition-colors relative shrink-0
            ${ov.enabled ? "bg-[#00AFCC]" : "bg-gray-300"}`}
        >
          <span
            className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform
              ${ov.enabled ? "translate-x-5" : "translate-x-0.5"}`}
          />
        </div>
        <span className="text-xs font-semibold text-gray-700">
          オーバーレイを使用
        </span>
      </label>

      {ov.enabled && (
        <>
          {/* プリセット */}
          <div>
            <p className="text-[10px] text-gray-400 mb-1.5">プリセット</p>
            <div className="grid grid-cols-2 gap-1.5">
              {OVERLAY_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => upd({ ...p, enabled: true })}
                  className="py-2 px-1.5 text-[11px] font-medium rounded-lg border border-gray-200
                    hover:border-[#00AFCC] hover:bg-[#E6F8FC] hover:text-[#00AFCC] transition-colors text-gray-600 leading-tight"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* 色 */}
          <ColorInput
            label="オーバーレイ色"
            value={ov.color}
            onChange={(v) => upd({ color: v })}
          />

          {/* 透明度 */}
          <SliderInput
            label="透明度"
            value={ov.opacity}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => upd({ opacity: v })}
          />

          {/* 背景ぼかし */}
          <SliderInput
            label="背景ぼかし"
            value={ov.blur}
            min={0}
            max={20}
            onChange={(v) => upd({ blur: v })}
          />

          <p className="text-[10px] text-gray-400 leading-relaxed">
            ぼかしは背景画像がある場合に効果的です。コンテンツは前面に保持されます。
          </p>
        </>
      )}
    </div>
  );
}

// ─── Section Panel ────────────────────────────────────────────────────────────

/**
 * CSS テキストから lp-* クラスの背景色を抽出する。
 * selector は ".lp-foo" 形式でも "[data-element-id='...']" 形式でも動作する。
 * lpClasses が提供された場合はそれを優先して使用（data-element-id 形式の selector でも正しく動作）。
 */
function extractBgFromCss(selector: string, css: string, lpClasses?: string[]): string {
  if (!css) return "";

  // 検索対象の lp-* クラス名リストを決定
  let classes: string[];
  if (lpClasses && lpClasses.length > 0) {
    classes = lpClasses.filter(c => c.startsWith("lp-") && !c.startsWith("lp-vs"));
  } else {
    // セレクターから .lp-* クラス名を抽出（複合セレクター ".lp-foo.lp-bar" にも対応）
    const matches = selector.match(/\.lp-[^.[\s:{]+/g) ?? [];
    classes = matches.map(c => c.slice(1));
  }
  if (!classes.length) return "";

  const isClear = (v: string) =>
    !v || v === "transparent" || /^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(v.trim());
  const firstColor = (v: string) => {
    const m = v.match(/rgba?\([^)]+\)|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b/);
    return m ? m[0] : "";
  };

  // 各クラスを個別に検索し、CSS ソース内で最後に登場したルールを採用（カスケード再現）
  let bestFound = "";
  let bestPos = -1;
  for (const lpClass of classes) {
    const re = new RegExp(`(?:^|[^\\w-])(\\.${lpClass})\\s*\\{([^}]+)\\}`, "gm");
    let match: RegExpExecArray | null;
    while ((match = re.exec(css)) !== null) {
      const pos = match.index;
      const block = match[2];
      let blockFound = "";
      const m1 = block.match(/background-color\s*:\s*([^;!}\n]+)/);
      if (m1) { const v = m1[1].trim(); if (!isClear(v) && v !== "initial" && v !== "inherit") blockFound = v; }
      const m2 = block.match(/(?<![a-z-])background\s*:\s*([^;!}\n]+)/);
      if (m2) { const c = firstColor(m2[1].trim()); if (c && !isClear(c)) blockFound = c; }
      if (blockFound && pos > bestPos) { bestFound = blockFound; bestPos = pos; }
    }
  }
  return bestFound;
}

function SectionPanel({
  s,
  cs,
  upd,
  rule,
  onUpdate,
  selector = "",
  effectiveCss = "",
  lpClasses,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
  rule: StyleRule;
  onUpdate: (partial: Partial<StyleRule>) => void;
  selector?: string;
  effectiveCss?: string;
  lpClasses?: string[];
}) {
  // 透明 or 白（グラデーション由来のフォールバック値）の場合は CSS から直接取得する
  const isBgUnclear = (v: string) =>
    !v || v === "transparent" ||
    v === "rgb(255, 255, 255)" ||
    /^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test(v.trim()) ||
    /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(v.trim());
  // s.backgroundColor（ユーザー上書き）が設定済みなら優先。
  // なければ computedStyles、それも不明値なら effectiveCss を直接パースして取得。
  // ※ visual override（/* ─ ビジュアル編集 ─ */以降）を除いた base CSS のみを参照する。
  //   そうしないと誤って保存された白 override が返ってしまう。
  const baseCssForBg = effectiveCss.includes("/* ─ ビジュアル編集 ─ */")
    ? effectiveCss.split("/* ─ ビジュアル編集 ─ */")[0]
    : effectiveCss;
  const sHasBg = s.backgroundColor && !isBgUnclear(s.backgroundColor);
  const rawBg = sHasBg ? s.backgroundColor! : cs.backgroundColor || "";
  const resolvedBg = isBgUnclear(rawBg)
    ? (extractBgFromCss(selector, baseCssForBg, lpClasses) || "#ffffff")
    : rawBg;
  return (
    <div className="space-y-4">
      <ColorInput
        label="背景色"
        value={resolvedBg}
        onChange={(v) => {
          // background-image: none も同時に設定し、gradient を solid color で上書きできるようにする
          // 注: 画像オーバーライド CSS は effectiveCss の後半で !important 上書きするため、
          // 画像設定済みセクションではこの none は無効化される（意図通り）
          upd({ backgroundColor: v, backgroundImage: "none" });
        }}
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
      <Divider label="枠線" />
      {(() => {
        const bw = parseBorderWidth(s.borderWidth || cs.borderWidth);
        const bc = parseBorderColor(s.borderColor || cs.borderColor);
        return (
          <>
            <SliderInput
              label="枠線太さ"
              value={bw}
              min={0}
              max={8}
              onChange={(v) => {
                if (v === 0) {
                  upd({ borderWidth: "0px", borderStyle: "none" });
                } else {
                  upd({ borderWidth: `${v}px`, borderStyle: "solid", borderColor: bc });
                }
              }}
            />
            {bw > 0 && (
              <ColorInput
                label="枠線色"
                value={bc}
                onChange={(v) => upd({ borderColor: v, borderStyle: "solid" })}
              />
            )}
          </>
        );
      })()}
      <Divider label="背景オーバーレイ" />
      <BackgroundOverlayPanel
        overlay={rule.overlay}
        onUpdate={(ov) => onUpdate({ overlay: ov })}
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
      {(() => {
        const bw = parseBorderWidth(s.borderWidth || cs.borderWidth);
        const bc = parseBorderColor(s.borderColor || cs.borderColor);
        return (
          <>
            <SliderInput
              label="枠線太さ"
              value={bw}
              min={0}
              max={8}
              onChange={(v) => {
                if (v === 0) {
                  upd({ borderWidth: "0px", borderStyle: "none", outline: "none" });
                } else {
                  upd({ borderWidth: `${v}px`, borderStyle: "solid", borderColor: bc, outline: "none" });
                }
              }}
            />
            {bw > 0 && (
              <ColorInput
                label="枠線色"
                value={bc}
                onChange={(v) => upd({ borderColor: v, borderStyle: "solid" })}
              />
            )}
          </>
        );
      })()}
    </div>
  );
}

// ─── Image Button sub-panel ──────────────────────────────────────────────────

function ImageButtonPanel({
  rule,
  onUpdate,
}: {
  rule: StyleRule;
  onUpdate: (partial: Partial<StyleRule>) => void;
}) {
  const ib = rule.imageButton;
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      onUpdate({
        imageButton: {
          url,
          alt: ib?.alt ?? "",
          width: ib?.width ?? "240px",
          height: ib?.height ?? "60px",
          maintainRatio: ib?.maintainRatio ?? false,
          fitMode: ib?.fitMode ?? "cover",
        },
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const upd = (partial: Partial<ButtonImageConfig>) => {
    if (!ib) return;
    onUpdate({ imageButton: { ...ib, ...partial } });
  };

  if (!ib?.url) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-gray-500 leading-relaxed">
          ボタンを画像に差し替えます。画像をアップロードするとボタンが非表示になり、画像が代わりに表示されます。
        </p>
        <label className="flex flex-col items-center gap-2 p-5 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-[#00AFCC] hover:bg-[#E6F8FC] transition-colors">
          <span className="text-3xl">🖼️</span>
          <span className="text-xs font-semibold text-gray-600">クリックして画像を選択</span>
          <span className="text-[10px] text-gray-400">PNG / JPG / SVG / GIF</span>
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Preview */}
      <div className="space-y-1.5">
        <span className="text-xs text-gray-500">プレビュー</span>
        <div className="relative rounded-lg border border-gray-200 overflow-hidden bg-gray-50 flex items-center justify-center" style={{ minHeight: 80 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ib.url}
            alt={ib.alt}
            style={{ maxHeight: 80, maxWidth: "100%", objectFit: "contain" }}
          />
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full py-1.5 text-[11px] text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          画像を変更
        </button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>

      {/* Alt text */}
      <Row label="altテキスト">
        <input
          type="text"
          value={ib.alt}
          onChange={(e) => upd({ alt: e.target.value })}
          placeholder="無料相談はこちら"
          className="w-full text-xs border border-gray-200 rounded px-2 py-1.5"
        />
      </Row>

      {/* Width */}
      <SelectInput
        label="横幅"
        value={ib.width}
        onChange={(v) => upd({ width: v })}
        options={[
          { value: "auto", label: "自動" },
          { value: "160px", label: "160px" },
          { value: "200px", label: "200px" },
          { value: "240px", label: "240px（デフォルト）" },
          { value: "300px", label: "300px" },
          { value: "360px", label: "360px" },
          { value: "100%", label: "100%（横幅いっぱい）" },
        ]}
      />

      {/* Height */}
      <SelectInput
        label="高さ"
        value={ib.height}
        onChange={(v) => upd({ height: v })}
        options={[
          { value: "auto", label: "自動" },
          { value: "44px", label: "44px" },
          { value: "52px", label: "52px" },
          { value: "60px", label: "60px（デフォルト）" },
          { value: "80px", label: "80px" },
          { value: "100px", label: "100px" },
          { value: "120px", label: "120px" },
        ]}
      />

      {/* Fit mode */}
      <SelectInput
        label="フィット方式"
        value={ib.fitMode ?? "cover"}
        onChange={(v) => upd({ fitMode: v as ButtonImageConfig["fitMode"] })}
        options={[
          { value: "cover", label: "カバー（白枠なし・推奨）" },
          { value: "contain", label: "コンテイン（画像全体を表示）" },
          { value: "stretch", label: "引き伸ばし（枠にぴったり）" },
        ]}
      />

      {/* Maintain ratio */}
      <label className="flex items-center gap-2.5 cursor-pointer">
        <input
          type="checkbox"
          checked={ib.maintainRatio}
          onChange={(e) => upd({ maintainRatio: e.target.checked })}
          className="w-4 h-4 accent-[#00AFCC] rounded"
        />
        <div>
          <p className="text-xs font-semibold text-gray-700">アスペクト比を維持</p>
          <p className="text-[10px] text-gray-400">HTML出力時に横幅のみ指定・高さ自動</p>
        </div>
      </label>

      {/* Revert */}
      <button
        onClick={() => onUpdate({ imageButton: null })}
        className="w-full py-2 text-xs text-red-500 hover:text-red-600 border border-red-200 hover:border-red-300 rounded-lg transition-colors font-medium"
      >
        通常のボタンに戻す
      </button>
    </div>
  );
}

// ─── Card / Box Panel ────────────────────────────────────────────────────────

function CardPanel({
  s,
  cs,
  upd,
}: {
  s: Record<string, string>;
  cs: Record<string, string>;
  upd: Upd;
}) {
  // 枠線の現在値（四辺統一として topWidth/topColor を基準）
  const borderWidth = px(s.borderWidth || cs.borderWidth, 0);
  const borderColor = rgbToHex(s.borderColor || cs.borderColor || "#e5e7eb");

  return (
    <div className="space-y-4">
      <ColorInput
        label="背景色"
        value={s.backgroundColor || sanitizeCsBg(cs.backgroundColor) || "#ffffff"}
        onChange={(v) => upd({ backgroundColor: v })}
      />

      <Divider label="枠線" />
      <SliderInput
        label="枠線太さ"
        value={borderWidth}
        min={0}
        max={8}
        onChange={(v) => {
          if (v === 0) {
            upd({ borderWidth: "0px", borderStyle: "none" });
          } else {
            upd({ borderWidth: v + "px", borderStyle: "solid", borderColor });
          }
        }}
      />
      <ColorInput
        label="枠線色"
        value={borderColor}
        onChange={(v) => upd({ borderColor: v, borderStyle: "solid", borderWidth: borderWidth > 0 ? borderWidth + "px" : "1px" })}
      />
      <SliderInput
        label="角丸"
        value={px(s.borderRadius || cs.borderRadius, 0)}
        min={0}
        max={40}
        onChange={(v) => upd({ borderRadius: v + "px" })}
      />
      <SelectInput
        label="影"
        value={s.boxShadow || "none"}
        onChange={(v) => upd({ boxShadow: v })}
        options={SHADOW_OPTIONS}
      />

      <Divider label="余白" />
      <SliderInput
        label="上下 padding"
        value={px(s.paddingTop || cs.paddingTop, 24)}
        min={0}
        max={80}
        step={4}
        onChange={(v) => upd({ paddingTop: v + "px", paddingBottom: v + "px" })}
      />
      <SliderInput
        label="左右 padding"
        value={px(s.paddingLeft || cs.paddingLeft, 24)}
        min={0}
        max={80}
        step={4}
        onChange={(v) => upd({ paddingLeft: v + "px", paddingRight: v + "px" })}
      />

      <Divider label="形状" />
      <SelectInput
        label="最大幅"
        value={s.maxWidth || "none"}
        onChange={(v) => upd({ maxWidth: v })}
        options={[
          { value: "none", label: "制限なし" },
          { value: "320px", label: "320px" },
          { value: "400px", label: "400px" },
          { value: "480px", label: "480px" },
          { value: "560px", label: "560px" },
          { value: "640px", label: "640px" },
        ]}
      />
    </div>
  );
}

// ─── Button Panel (5 tabs) ────────────────────────────────────────────────────

type BtnTab = "design" | "size" | "align" | "motion" | "image";

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
    { id: "image", label: "🖼 画像" },
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
                ? "bg-[#00AFCC] text-white"
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
            value={s.backgroundColor || sanitizeCsBg(cs.backgroundColor) || "#6366f1"}
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
          {/* 枠線: 太さスライダー + カラーピッカー */}
          {(() => {
            const bw = parseBorderWidth(s.borderWidth || s.border || cs.borderWidth);
            const bc = parseBorderColor(s.borderColor || s.border || cs.borderColor);
            return (
              <>
                <SliderInput
                  label="枠線太さ"
                  value={bw}
                  min={0}
                  max={8}
                  onChange={(v) => {
                    if (v === 0) {
                      upd({ border: "none", borderWidth: "0px", borderStyle: "none", borderColor: "" });
                    } else {
                      upd({ border: `${v}px solid ${bc}`, borderWidth: `${v}px`, borderStyle: "solid", borderColor: bc });
                    }
                  }}
                />
                {bw > 0 && (
                  <ColorInput
                    label="枠線色"
                    value={bc}
                    onChange={(v) => upd({ border: `${bw}px solid ${v}`, borderWidth: `${bw}px`, borderStyle: "solid", borderColor: v })}
                  />
                )}
              </>
            );
          })()}
          <Divider label="ホバー時" />
          <ColorInput
            label="ホバー背景"
            value={h.backgroundColor || s.backgroundColor || sanitizeCsBg(cs.backgroundColor) || "#4f46e5"}
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
                  className="py-2.5 text-xs border border-gray-200 rounded-lg hover:border-[#00AFCC] hover:text-[#00AFCC] transition-colors font-medium"
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
              className="w-4 h-4 accent-[#00AFCC] rounded"
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
                      ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                      : "border-gray-200 text-gray-600 hover:border-[#00AFCC]"
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

      {/* ── 画像 tab ── */}
      {tab === "image" && (
        <ImageButtonPanel rule={rule} onUpdate={onUpdate} />
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
  onDelete?: () => void;
  effectiveCss?: string;
  /** 親セクションの背景色編集ボタンが押された時のコールバック */
  onSelectSection?: (lpClasses: string[]) => void;
}

const TYPE_ICONS: Record<string, string> = {
  heading: "H",
  text: "¶",
  button: "▶",
  section: "▣",
  image: "⬜",
  card: "▥",
};

const TYPE_LABELS: Record<string, string> = {
  heading: "見出し",
  text: "本文",
  button: "ボタン",
  section: "セクション",
  image: "画像",
  card: "カード / 枠",
};

export default function VisualStylePanel({
  element,
  currentRule,
  onUpdate,
  onDeselect,
  onDelete,
  effectiveCss = "",
  onSelectSection,
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
      imageButton: null,
    });

  const hasOverrides =
    Object.keys(s).length > 0 ||
    Object.keys(currentRule?.hoverStyles ?? {}).length > 0 ||
    (currentRule?.animation && currentRule.animation !== "none") ||
    currentRule?.mobileFullWidth ||
    !!currentRule?.imageButton?.url;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 shrink-0">
        <span className="w-7 h-7 rounded-lg bg-[#E6F8FC] text-[#00AFCC] text-xs font-bold flex items-center justify-center shrink-0">
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

      {/* セクション背景編集への誘導ボタン（セクション以外の要素が選択されていて、親セクションがある場合） */}
      {element.type !== "section" && element.parentSectionLpClasses && element.parentSectionLpClasses.length > 0 && onSelectSection && (
        <button
          onClick={() => onSelectSection(element.parentSectionLpClasses!)}
          className="mx-4 mt-2 mb-0 py-1.5 w-[calc(100%-2rem)] text-[11px] font-semibold text-[#00AFCC] border border-[#00AFCC] rounded-lg hover:bg-[#E6F8FC] transition-colors flex items-center justify-center gap-1"
        >
          <span>▣</span>
          <span>セクション背景を編集</span>
        </button>
      )}

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
          <SectionPanel s={s} cs={cs} upd={upd} rule={currentRule} onUpdate={updRule} selector={element.selector} effectiveCss={effectiveCss} lpClasses={element.lpClasses} />
        )}
        {element.type === "image" && <ImagePanel s={s} cs={cs} upd={upd} />}
        {element.type === "card" && <CardPanel s={s} cs={cs} upd={upd} />}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-100 shrink-0 space-y-2">
        {hasOverrides && (
          <div className="flex items-center gap-1.5 text-[10px] text-[#00AFCC] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00AFCC]" />
            スタイル変更済み
          </div>
        )}
        <button
          onClick={handleReset}
          className="w-full py-2 text-xs text-gray-400 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
        >
          このスタイルをリセット
        </button>
        {onDelete && element.type !== "section" && (
          <button
            onClick={onDelete}
            className="w-full py-2 text-xs text-red-500 hover:text-white hover:bg-red-500 border border-red-200 hover:border-red-500 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
            </svg>
            この要素を削除
          </button>
        )}
      </div>
    </div>
  );
}
