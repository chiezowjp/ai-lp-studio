import { VisualStyles } from "@/types";

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (m) => "-" + m.toLowerCase());
}

/** hex "#rrggbb" → "r,g,b" */
function hexToRgb(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `${r},${g},${b}`;
}

export function buildVisualCss(vs: VisualStyles): string {
  if (!vs || Object.keys(vs).length === 0) return "";

  const lines: string[] = ["/* ─ ビジュアル編集 ─ */"];
  let hasPulse = false;

  for (const [selector, rule] of Object.entries(vs)) {
    if (!rule) continue;
    const s = rule.styles ?? {};
    const h = rule.hoverStyles ?? {};

    const sEntries = Object.entries(s).filter(([, v]) => v !== undefined && v !== "");
    if (sEntries.length > 0) {
      lines.push(`${selector} {`);
      for (const [prop, val] of sEntries) {
        lines.push(`  ${camelToKebab(prop)}: ${val} !important;`);
      }
      lines.push("}");
    }

    const hEntries = Object.entries(h).filter(([, v]) => v !== undefined && v !== "");
    if (hEntries.length > 0) {
      lines.push(`${selector}:hover {`);
      for (const [prop, val] of hEntries) {
        lines.push(`  ${camelToKebab(prop)}: ${val} !important;`);
      }
      lines.push("}");
    }

    const anim = rule.animation;
    if (anim && anim !== "none") {
      if (anim === "lift") {
        lines.push(`${selector} { transition: transform .25s ease, box-shadow .25s ease !important; }`);
        lines.push(`${selector}:hover { transform: translateY(-5px) !important; box-shadow: 0 14px 30px rgba(0,0,0,.18) !important; }`);
      } else if (anim === "scale") {
        lines.push(`${selector} { transition: transform .2s ease !important; }`);
        lines.push(`${selector}:hover { transform: scale(1.06) !important; }`);
      } else if (anim === "pulse") {
        hasPulse = true;
        lines.push(`${selector} { animation: lp-pulse 2.4s ease-in-out infinite !important; }`);
      }
    }

    if (rule.mobileFullWidth) {
      lines.push("@media (max-width: 640px) {");
      lines.push(
        `  ${selector} { width: 100% !important; display: block !important; box-sizing: border-box !important; text-align: center !important; margin-left: 0 !important; margin-right: 0 !important; }`
      );
      lines.push("}");
    }

    // ── 背景オーバーレイ ────────────────────────────────────────────────────
    // ::after 疑似要素でオーバーレイ色・透明度・backdrop-filter blur を実現。
    // コンテンツは position:relative / z-index:1 で前面に保持する。
    const ov = rule.overlay;
    if (ov?.enabled && (ov.opacity > 0 || ov.blur > 0)) {
      const rgb   = hexToRgb(ov.color || "#000000");
      const alpha = (Math.min(ov.opacity, 100) / 100).toFixed(2);

      // セクション自体に position:relative / overflow:hidden を付与
      lines.push(`${selector} { position: relative !important; overflow: hidden !important; }`);

      // 直下の子要素を前面に（オーバーレイの上に）
      lines.push(`${selector} > * { position: relative !important; z-index: 1 !important; }`);

      // オーバーレイ本体（::after）
      lines.push(`${selector}::after {`);
      lines.push(`  content: "" !important;`);
      lines.push(`  position: absolute !important;`);
      lines.push(`  inset: 0 !important;`);
      lines.push(`  background: rgba(${rgb},${alpha}) !important;`);
      lines.push(`  z-index: 0 !important;`);
      lines.push(`  pointer-events: none !important;`);
      if (ov.blur > 0) {
        const b = Math.min(ov.blur, 20);
        lines.push(`  backdrop-filter: blur(${b}px) !important;`);
        lines.push(`  -webkit-backdrop-filter: blur(${b}px) !important;`);
      }
      lines.push(`}`);
    }

    // imageButton は CSS ではなく LPPreview の JS 注入 + applyButtonImages で処理するため
    // visualStyles には残さない（CSS tab には出力しない）
  }

  if (hasPulse) {
    lines.push("@keyframes lp-pulse {");
    lines.push("  0%,100%{ opacity:1; transform:scale(1); }");
    lines.push("  50%{ opacity:.86; transform:scale(1.018); }");
    lines.push("}");
  }

  return lines.join("\n") + "\n";
}
