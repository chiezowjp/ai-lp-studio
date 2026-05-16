"use client";

import { useEffect, useRef, useCallback } from "react";
import { UploadedImage, PreviewMode, SelectedElement } from "@/types";

function placementToSelector(placement: string): string {
  return placement === "other" ? ".lp-wrapper" : `.lp-${placement}`;
}

// ─── Style-select injection script ───────────────────────────────────────────

const STYLE_SELECT_JS = `(function () {
  var SECTION_SEL = '.lp-hero,.lp-problem,.lp-reason,.lp-service,.lp-testimonial,.lp-cta,.lp-faq,.lp-gallery,.lp-map,.lp-contact,.lp-voices,.lp-beforeafter,.lp-linecta,.lp-instagram,.lp-fixedcta,.lp-wrapper';

  var st = document.createElement('style');
  st.setAttribute('data-lp-vs','1');
  st.textContent = [
    '.lp-vs-h{outline:2px dashed rgba(99,102,241,.55)!important;outline-offset:3px!important;cursor:pointer!important;}',
    '.lp-vs-a{outline:3px solid #6366f1!important;outline-offset:3px!important;background:rgba(99,102,241,.05)!important;}'
  ].join('');
  document.head.appendChild(st);

  var activeEl = null;

  function findTarget(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.hasAttribute && el.hasAttribute('data-lp-vs')) return null;
    var btn = el.closest && el.closest('a, button');
    if (btn && btn !== document.body) return btn;
    var h = el.closest && el.closest('h1,h2,h3,h4,h5,h6');
    if (h) return h;
    if (el.tagName === 'IMG') return el;
    var p = el.closest && el.closest('p, li');
    if (p) return p;
    var sec = el.closest && el.closest(SECTION_SEL);
    if (sec) return sec;
    return null;
  }

  function getType(el) {
    var t = el.tagName.toLowerCase();
    if (/^h[1-6]$/.test(t)) return 'heading';
    if (t === 'a' || t === 'button') return 'button';
    if (t === 'img') return 'image';
    if (t === 'p' || t === 'li') return 'text';
    return 'section';
  }

  function buildSelector(el) {
    var t = el.tagName.toLowerCase();
    var lpCls = [];
    el.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) lpCls.push(c); });
    if (lpCls.length) return '.' + lpCls[0];
    var sec = el.closest && el.closest(SECTION_SEL);
    if (sec) {
      var secCls = [];
      sec.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) secCls.push(c); });
      if (secCls.length) return '.' + secCls[0] + ' ' + t;
    }
    return t;
  }

  function getStyles(el) {
    var cs = window.getComputedStyle(el);
    return {
      color: cs.color, backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign, borderRadius: cs.borderRadius,
      paddingTop: cs.paddingTop, paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft,
      boxShadow: cs.boxShadow, maxWidth: cs.maxWidth,
      textShadow: cs.textShadow, width: cs.width, minHeight: cs.minHeight
    };
  }

  document.addEventListener('mouseover', function(e) {
    var t = findTarget(e.target);
    document.querySelectorAll('.lp-vs-h').forEach(function(el) { el.classList.remove('lp-vs-h'); });
    if (t && t !== activeEl) t.classList.add('lp-vs-h');
  });
  document.addEventListener('mouseout', function(e) {
    var t = findTarget(e.target);
    if (t && t !== activeEl) t.classList.remove('lp-vs-h');
  });

  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var t = findTarget(e.target);
    if (activeEl) { activeEl.classList.remove('lp-vs-a'); activeEl = null; }
    if (!t) { window.parent.postMessage({ type: 'lp-vs-deselect' }, '*'); return; }
    t.classList.remove('lp-vs-h');
    t.classList.add('lp-vs-a');
    activeEl = t;
    window.parent.postMessage({
      type: 'lp-vs-select',
      elementType: getType(t),
      selector: buildSelector(t),
      tagName: t.tagName.toLowerCase(),
      label: (t.textContent || '').trim().slice(0, 40),
      computedStyles: getStyles(t)
    }, '*');
  }, true);

  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'lp-vs-highlight') {
      document.querySelectorAll('.lp-vs-a').forEach(function(el) { el.classList.remove('lp-vs-a'); });
      activeEl = null;
      if (e.data.selector) {
        try {
          var el = document.querySelector(e.data.selector);
          if (el) { el.classList.add('lp-vs-a'); activeEl = el; }
        } catch(err) {}
      }
    }
  });
})();`;

// Block-level tags that prevent an element from being leaf-editable
const EDIT_JS = `(function () {
  var BLOCK = { DIV:1,SECTION:1,ARTICLE:1,ASIDE:1,NAV:1,HEADER:1,FOOTER:1,
                MAIN:1,FIGURE:1,UL:1,OL:1,TABLE:1,TBODY:1,THEAD:1,TR:1,FORM:1 };
  var SEL = 'h1,h2,h3,h4,h5,h6,p,button,a,li,span,strong,em,small,label,dt,dd,th,td,blockquote';
  var cur = null;

  /* ── inject styles ── */
  var st = document.createElement('style');
  st.setAttribute('data-lp-editor','1');
  st.textContent = [
    '.lp-eh { outline:2px dashed rgba(99,102,241,.65)!important; outline-offset:2px!important; cursor:text!important; }',
    '.lp-ea { outline:2px solid #6366f1!important; outline-offset:2px!important; background:rgba(99,102,241,.06)!important; border-radius:2px!important; }',
    '#lp-tip { position:fixed; top:10px; left:50%; transform:translateX(-50%); background:#6366f1; color:#fff;',
    '          font:bold 11px/1.5 sans-serif; padding:4px 14px; border-radius:20px;',
    '          pointer-events:none; z-index:99999; opacity:0; transition:opacity .25s; white-space:nowrap; }',
    '#lp-tip.on { opacity:1; }'
  ].join('');
  document.head.appendChild(st);

  /* ── tip banner ── */
  var tip = document.createElement('div');
  tip.id = 'lp-tip';
  tip.setAttribute('data-lp-editor','1');
  tip.textContent = '✏ クリックで編集 — Esc / Enter で確定';
  document.body.appendChild(tip);
  var tipTimer;
  function showTip() { clearTimeout(tipTimer); tip.classList.add('on'); tipTimer = setTimeout(function(){ tip.classList.remove('on'); }, 2500); }

  /* ── helpers ── */
  function isLeaf(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (BLOCK[el.children[i].tagName]) return false;
    }
    return true;
  }
  function findTarget(node) {
    var el = node;
    while (el && el !== document.body) {
      if (el.matches && el.matches(SEL) && isLeaf(el) && !el.getAttribute('data-lp-editor')) return el;
      el = el.parentElement;
    }
    return null;
  }

  /* ── hover ── */
  document.addEventListener('mouseover', function(e) {
    var el = findTarget(e.target);
    if (el && el !== cur) { el.classList.add('lp-eh'); showTip(); }
  });
  document.addEventListener('mouseout', function(e) {
    var el = findTarget(e.target);
    if (el && el !== cur) el.classList.remove('lp-eh');
  });

  /* ── click to edit ── */
  document.addEventListener('click', function(e) {
    var el = findTarget(e.target);
    if (!el) { if (cur) finish(); return; }
    e.preventDefault();
    if (el === cur) return;
    if (cur) finish();
    el.classList.remove('lp-eh');
    el.classList.add('lp-ea');
    el.setAttribute('contenteditable','true');
    el.focus();
    if (document.caretRangeFromPoint) {
      var r = document.caretRangeFromPoint(e.clientX, e.clientY);
      if (r) { var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r); }
    }
    cur = el;
  }, true);

  /* ── keyboard ── */
  document.addEventListener('keydown', function(e) {
    if (!cur) return;
    if (e.key === 'Escape') { e.preventDefault(); finish(); }
    if (e.key === 'Enter' && cur.tagName !== 'P' && cur.tagName !== 'LI' && cur.tagName !== 'TD' && cur.tagName !== 'TH') {
      e.preventDefault(); finish();
    }
  });
  document.addEventListener('blur', function(e) { if (e.target === cur) finish(); }, true);

  /* ── finish & notify parent ── */
  function finish() {
    if (!cur) return;
    cur.removeAttribute('contenteditable');
    cur.classList.remove('lp-ea');
    cur = null;
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll('[data-lp-editor]').forEach(function(el) { el.parentNode.removeChild(el); });
    clone.querySelectorAll('[contenteditable]').forEach(function(el) { el.removeAttribute('contenteditable'); });
    window.parent.postMessage({ type: 'lp-html-update', html: clone.innerHTML }, '*');
  }
})();`;

interface Props {
  html: string;
  css: string;
  mode?: PreviewMode;
  imageOverrides?: UploadedImage[];
  onHtmlChange?: (html: string) => void;
  iframeHeight?: number;
  // Style editing
  editMode?: "text" | "style";
  onElementSelect?: (el: SelectedElement | null) => void;
  selectedSelector?: string | null;
}

export default function LPPreview({
  html,
  css,
  mode = "desktop",
  imageOverrides = [],
  onHtmlChange,
  iframeHeight = 600,
  editMode = "text",
  onElementSelect,
  selectedSelector,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const skipNextRef = useRef(false);
  const selectedSelectorRef = useRef<string | null>(selectedSelector ?? null);
  const editable = !!onHtmlChange;

  useEffect(() => {
    selectedSelectorRef.current = selectedSelector ?? null;
  }, [selectedSelector]);

  const buildContent = useCallback(() => {
    const imageCss = imageOverrides
      .map((img) => {
        const sel = placementToSelector(img.placement);
        return `${sel} { background-image: url('${img.url}') !important; background-size: cover !important; background-position: center !important; }`;
      })
      .join("\n");

    // Style-select mode injects its own script regardless of onHtmlChange
    let editBlock = "";
    if (editMode === "style") {
      editBlock = `\n<script>\n${STYLE_SELECT_JS}\n<` + `/script>`;
    } else if (editable) {
      editBlock = `\n<script>\n${EDIT_JS}\n<` + `/script>`;
    }

    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">
<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: 'Noto Sans JP', 'Hiragino Kaku Gothic ProN', sans-serif; }
img { max-width: 100%; height: auto; }
${css}
${imageCss}
</style>
</head>
<body>${html}${editBlock}
</body>
</html>`;
  }, [html, css, imageOverrides, editable, editMode]);

  // Sync iframe content — skip when triggered by our own edit
  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false;
      return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = buildContent();
  }, [buildContent]);

  // Re-highlight selected element after iframe reloads (CSS change causes reload)
  useEffect(() => {
    if (editMode !== "style") return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    const onLoad = () => {
      const sel = selectedSelectorRef.current;
      if (sel) {
        iframe.contentWindow?.postMessage({ type: "lp-vs-highlight", selector: sel }, "*");
      }
    };
    iframe.addEventListener("load", onLoad);
    return () => iframe.removeEventListener("load", onLoad);
  }, [editable, editMode]);

  // Listen for postMessage from the iframe
  useEffect(() => {
    if (!editable && editMode !== "style") return;
    const handler = (e: MessageEvent) => {
      // Text edit updates — ignored in style mode
      if (e.data?.type === "lp-html-update" && editMode !== "style") {
        skipNextRef.current = true;
        onHtmlChange?.(e.data.html as string);
      }
      if (e.data?.type === "lp-vs-select") {
        onElementSelect?.({
          type: e.data.elementType,
          selector: e.data.selector,
          tagName: e.data.tagName,
          label: e.data.label,
          computedStyles: e.data.computedStyles,
        });
      }
      if (e.data?.type === "lp-vs-deselect") {
        onElementSelect?.(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [editable, editMode, onHtmlChange, onElementSelect]);

  // ─── Unified render ───────────────────────────────────────────────────────
  // IMPORTANT: iframe must never be unmounted/remounted on mode change.
  // If we return a different JSX tree (e.g. bare <iframe> vs <div><iframe>),
  // React recreates the iframe DOM node, losing srcdoc since buildContent's
  // deps don't include `mode`.  We solve this by always rendering the same
  // outer structure and only changing styles based on mode.
  const isMobile = mode === "mobile";

  return (
    // Outer wrapper: desktop=h-full, mobile=centered bg area (phone frame scrolls internally)
    <div
      className={isMobile ? "flex justify-center py-6" : "h-full"}
      style={isMobile ? { background: "#f3f4f6" } : {}}
    >
      {/* Phone-frame shell — desktop: transparent passthrough, mobile: phone chrome */}
      <div
        className="relative"
        style={
          isMobile
            ? {
                width: 375,
                border: "6px solid #1f2937",
                borderRadius: "2.5rem",
                overflow: "hidden",
                boxShadow: "0 25px 50px -12px rgba(0,0,0,.25)",
                flexShrink: 0,
                // content-box so width:375 = content, border adds visually outside
                boxSizing: "content-box" as const,
              }
            : { width: "100%", height: "100%" }
        }
      >
        {/* Phone notch — always in DOM (keeps iframe at stable child index) */}
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: "5rem",
            height: "1.25rem",
            background: "#1f2937",
            borderRadius: "0 0 1rem 1rem",
            zIndex: 20,
            pointerEvents: "none",
            // visible only in mobile; display:none keeps it in DOM so iframe
            // stays as child[1] regardless of mode
            display: isMobile ? "block" : "none",
          }}
        />

        {/* ── iframe ── always child[1]; never remounts on mode change ── */}
        <iframe
          ref={iframeRef}
          sandbox="allow-same-origin allow-scripts"
          title={isMobile ? "LPモバイルプレビュー" : "LPプレビュー"}
          style={{
            border: "none",
            display: "block",
            // mobile: fill the 375px phone content area; desktop: fill container
            width: "100%",
            height: iframeHeight,
          }}
        />
      </div>
    </div>
  );
}
