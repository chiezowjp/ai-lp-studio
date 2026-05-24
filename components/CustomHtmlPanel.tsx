"use client";

import React, { useState, useMemo, useCallback } from "react";

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * カスタムHTMLのサニタイズ
 * 許可: iframe / div / form / embed / style属性 / data-*
 * 禁止: <script> / on* イベント属性 / javascript: スキーム
 */
export function sanitizeCustomHtml(raw: string): string {
  // <script>...</script> を除去
  let s = raw.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  // on* イベント属性を除去（onclick, onload, onerror, etc.）
  s = s.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // javascript: スキームを除去
  s = s.replace(/href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'href="#"');
  s = s.replace(/src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi, 'src=""');
  return s.trim();
}

// ─── DOM Helpers ──────────────────────────────────────────────────────────────

/** セクションのユニーククラス (lp-customhtml_uid) を selector から抽出 */
function extractUniqueClass(selector: string): string | null {
  const m = selector.match(/\.lp-customhtml_([a-z0-9]+)/);
  return m ? `lp-customhtml_${m[1]}` : null;
}

/** .lp-ch-inner の innerHTML を取得 */
function getInnerHtml(html: string, uniqueClass: string): string {
  if (typeof window === "undefined") return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sec = doc.querySelector(`.${uniqueClass}`);
  return sec?.querySelector(".lp-ch-inner")?.innerHTML?.trim() ?? "";
}

/** セクションのスタイル設定を取得 */
interface ChStyle {
  paddingV: string;
  paddingH: string;
  maxWidth: string;
  bgColor: string;
  borderRadius: string;
  textAlign: string;
}

function getChStyle(html: string, uniqueClass: string): ChStyle {
  if (typeof window === "undefined") {
    return { paddingV: "48", paddingH: "20", maxWidth: "900", bgColor: "#ffffff", borderRadius: "0", textAlign: "center" };
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sec = doc.querySelector(`.${uniqueClass}`) as HTMLElement | null;
  const inner = sec?.querySelector(".lp-ch-inner") as HTMLElement | null;

  const secStyle = sec?.getAttribute("style") ?? "";
  const innerStyle = inner?.getAttribute("style") ?? "";

  const getPx = (style: string, prop: string, fallback: string) => {
    const m = style.match(new RegExp(prop + "\\s*:\\s*([\\d.]+)px"));
    return m ? m[1] : fallback;
  };
  const getVal = (style: string, prop: string, fallback: string) => {
    const m = style.match(new RegExp(prop + "\\s*:\\s*([^;]+)"));
    return m ? m[1].trim() : fallback;
  };

  return {
    paddingV: getPx(secStyle, "padding-top", "48"),
    paddingH: getPx(secStyle, "padding-left", "20"),
    maxWidth: (() => {
      const m = innerStyle.match(/max-width\s*:\s*([\d.]+)/);
      return m ? m[1] : "900";
    })(),
    bgColor: getVal(secStyle, "background(?:-color)?", "#ffffff"),
    borderRadius: getPx(secStyle, "border-radius", "0"),
    textAlign: getVal(innerStyle, "text-align", "center"),
  };
}

/** カスタムHTMLセクションを更新して新しいHTML文字列を返す */
export function updateCustomHtmlSection(
  html: string,
  uniqueClass: string,
  innerHtml: string,
  style: ChStyle,
): string {
  if (typeof window === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const sec = doc.querySelector(`.${uniqueClass}`) as HTMLElement | null;
  if (!sec) return html;

  const inner = sec.querySelector(".lp-ch-inner") as HTMLElement | null;
  if (!inner) return html;

  // セクション自体のスタイル
  const pv = `${style.paddingV}px`;
  const ph = `${style.paddingH}px`;
  sec.setAttribute(
    "style",
    `padding:${pv} ${ph};background:${style.bgColor};border-radius:${style.borderRadius}px;`,
  );

  // インナーのスタイル
  const mw = `${style.maxWidth}px`;
  inner.setAttribute(
    "style",
    `max-width:${mw};margin:0 auto;text-align:${style.textAlign};`,
  );

  // 内部 HTML（サニタイズ済み）
  inner.innerHTML = innerHtml;

  return doc.body.innerHTML;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  selector: string; // e.g. ".lp-customhtml_abc123.lp-customhtml"
  html: string;
  onUpdate: (newHtml: string) => void;
  onDeselect: () => void;
}

const PRESETS = [
  { label: "YouTube", placeholder: '<iframe width="560" height="315" src="https://www.youtube.com/embed/VIDEO_ID" frameborder="0" allowfullscreen></iframe>' },
  { label: "Googleフォーム", placeholder: '<iframe src="https://docs.google.com/forms/d/e/FORM_ID/viewform?embedded=true" width="640" height="480" frameborder="0"></iframe>' },
  { label: "Googleマップ", placeholder: '<iframe src="https://maps.google.com/maps?q=東京都渋谷区&output=embed&hl=ja" width="100%" height="400" frameborder="0" allowfullscreen></iframe>' },
  { label: "Calendly", placeholder: '<iframe src="https://calendly.com/YOUR_USERNAME" width="100%" height="630" frameborder="0"></iframe>' },
];

function SliderRow({
  label, value, min, max, unit, onChange,
}: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="text-[10px] font-semibold text-gray-500">{label}</span>
        <span className="text-[10px] text-gray-400">{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#00AFCC]" />
    </div>
  );
}

export default function CustomHtmlPanel({ selector, html, onUpdate, onDeselect }: Props) {
  const uniqueClass = useMemo(() => extractUniqueClass(selector), [selector]);

  const currentInner = useMemo(
    () => (uniqueClass ? getInnerHtml(html, uniqueClass) : ""),
    [html, uniqueClass],
  );
  const currentStyle = useMemo(
    () => (uniqueClass ? getChStyle(html, uniqueClass) : null),
    [html, uniqueClass],
  );

  const [code, setCode] = useState(currentInner);
  const [style, setStyle] = useState<ChStyle>(
    currentStyle ?? { paddingV: "48", paddingH: "20", maxWidth: "900", bgColor: "#ffffff", borderRadius: "0", textAlign: "center" },
  );
  const [tab, setTab] = useState<"code" | "style">("code");
  const [error, setError] = useState<string | null>(null);

  // uniqueClass が変わったら（別のセクションをクリック）リセット
  const prevClass = React.useRef(uniqueClass);
  if (prevClass.current !== uniqueClass) {
    prevClass.current = uniqueClass;
    setCode(currentInner);
    setStyle(currentStyle ?? { paddingV: "48", paddingH: "20", maxWidth: "900", bgColor: "#ffffff", borderRadius: "0", textAlign: "center" });
    setError(null);
  }

  const apply = useCallback(() => {
    if (!uniqueClass) return;
    const sanitized = sanitizeCustomHtml(code);
    if (sanitized !== code) {
      setError("⚠️ 安全上の理由でscriptタグ・イベント属性を除去しました");
      setCode(sanitized);
    } else {
      setError(null);
    }
    onUpdate(updateCustomHtmlSection(html, uniqueClass, sanitized, style));
  }, [uniqueClass, code, style, html, onUpdate]);

  const applyStyle = useCallback(() => {
    if (!uniqueClass) return;
    onUpdate(updateCustomHtmlSection(html, uniqueClass, sanitizeCustomHtml(code), style));
  }, [uniqueClass, code, style, html, onUpdate]);

  const upd = (partial: Partial<ChStyle>) => setStyle((s) => ({ ...s, ...partial }));

  if (!uniqueClass) {
    return <div className="p-4 text-xs text-gray-400">セクションが見つかりません</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-lg font-mono font-bold text-gray-600">{`</>`}</span>
            <div>
              <p className="text-sm font-bold text-gray-800">カスタムHTML</p>
              <p className="text-xs text-gray-400">iframe・埋め込みコードを編集</p>
            </div>
          </div>
          <button
            onClick={onDeselect}
            className="text-gray-400 hover:text-gray-600 text-xs px-2 py-1 rounded hover:bg-gray-100 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["code", "style"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-colors ${
                tab === t ? "bg-[#00AFCC] text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {t === "code" ? "💻 HTMLコード" : "🎨 スタイル"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "code" && (
          <div className="px-4 py-3 space-y-3">
            {/* プリセット */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1.5">プリセット挿入</p>
              <div className="grid grid-cols-2 gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p.label}
                    onClick={() => setCode(p.placeholder)}
                    className="px-2 py-1.5 text-[10px] font-medium rounded-lg border border-gray-200 hover:border-[#00AFCC] hover:bg-[#E6F8FC] hover:text-[#00AFCC] text-gray-600 transition-colors text-left"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* コード入力 */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1">HTMLコード</p>
              <textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={10}
                className="w-full text-[11px] font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-[#00AFCC] resize-y bg-gray-50"
                placeholder={`<!-- iframe・埋め込みコードをここに貼り付け -->
<iframe src="https://..." width="100%" height="400" frameborder="0"></iframe>`}
                spellCheck={false}
              />
            </div>

            {error && (
              <p className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-[10px] text-blue-600 space-y-0.5">
              <p className="font-semibold">✅ 使用できるもの</p>
              <p>iframe / div / form / embed / style属性</p>
              <p className="font-semibold mt-1">🚫 自動除去されるもの</p>
              <p>scriptタグ / on*イベント属性 / javascript:</p>
            </div>

            <button
              onClick={apply}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#00AFCC] text-white hover:bg-[#0099b3] transition-colors"
            >
              プレビューに反映
            </button>
          </div>
        )}

        {tab === "style" && (
          <div className="px-4 py-3 space-y-4">
            <SliderRow label="上下余白" value={Number(style.paddingV)} min={0} max={120} unit="px"
              onChange={(v) => upd({ paddingV: String(v) })} />
            <SliderRow label="左右余白" value={Number(style.paddingH)} min={0} max={80} unit="px"
              onChange={(v) => upd({ paddingH: String(v) })} />
            <SliderRow label="最大幅" value={Number(style.maxWidth)} min={300} max={1400} unit="px"
              onChange={(v) => upd({ maxWidth: String(v) })} />
            <SliderRow label="角丸" value={Number(style.borderRadius)} min={0} max={32} unit="px"
              onChange={(v) => upd({ borderRadius: String(v) })} />

            {/* 背景色 */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="text-[10px] font-semibold text-gray-500">背景色</span>
              </div>
              <div className="flex items-center gap-2">
                <label className="w-7 h-7 rounded-md border border-gray-300 cursor-pointer shrink-0 overflow-hidden"
                  style={{ backgroundColor: style.bgColor }}>
                  <input type="color" value={style.bgColor}
                    onChange={(e) => upd({ bgColor: e.target.value })}
                    className="opacity-0 w-full h-full cursor-pointer" />
                </label>
                <input type="text" value={style.bgColor}
                  onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) upd({ bgColor: e.target.value }); }}
                  className="flex-1 text-xs font-mono border border-gray-200 rounded px-2 py-1"
                  maxLength={7} />
                <button onClick={() => upd({ bgColor: "transparent" })}
                  className="text-[10px] text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2 py-1">
                  透明
                </button>
              </div>
            </div>

            {/* 中央寄せ */}
            <div>
              <p className="text-[10px] font-semibold text-gray-500 mb-1">コンテンツ配置</p>
              <div className="flex gap-1">
                {(["left", "center", "right"] as const).map((a) => (
                  <button key={a}
                    onClick={() => upd({ textAlign: a })}
                    className={`flex-1 py-1.5 text-[10px] font-semibold rounded-lg border transition-colors ${
                      style.textAlign === a
                        ? "bg-[#00AFCC] text-white border-[#00AFCC]"
                        : "border-gray-200 text-gray-500 hover:border-[#00AFCC]"
                    }`}>
                    {a === "left" ? "← 左" : a === "center" ? "中央" : "右 →"}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={applyStyle}
              className="w-full py-2.5 text-xs font-bold rounded-xl bg-[#00AFCC] text-white hover:bg-[#0099b3] transition-colors"
            >
              スタイルを反映
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
