import { VisualStyles } from "@/types";

function camelToKebab(str: string): string {
  return str.replace(/([A-Z])/g, (m) => "-" + m.toLowerCase());
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
  }

  if (hasPulse) {
    lines.push("@keyframes lp-pulse {");
    lines.push("  0%,100%{ opacity:1; transform:scale(1); }");
    lines.push("  50%{ opacity:.86; transform:scale(1.018); }");
    lines.push("}");
  }

  return lines.join("\n") + "\n";
}
