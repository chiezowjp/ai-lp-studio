"use client";

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from "react";
import { UploadedImage, PreviewMode, SelectedElement, ButtonImageConfig } from "@/types";

function placementToSelector(placement: string): string {
  return placement === "other" ? ".lp-wrapper" : `.lp-${placement}`;
}

// ─── Section scroll script（常時注入：モード問わず有効）─────────────────────
// 親ウィンドウから { type:'lp-scroll-to', sectionId:'hero' } を受け取り
// .lp-{id} / [data-section-id="{id}"] / #{id} の順に要素を探してスクロール＋ハイライト

const SCROLL_JS = `(function () {
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'lp-scroll-to') return;
    var id = e.data.sectionId;
    var el = document.querySelector('.lp-' + id)
          || document.querySelector('[data-section-id="' + id + '"]')
          || document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // 一時ハイライト（1.8秒）
    var prev = { outline: el.style.outline, outlineOffset: el.style.outlineOffset, transition: el.style.transition };
    el.style.transition = 'outline-color 0.25s';
    el.style.outline = '3px solid #00AFCC';
    el.style.outlineOffset = '4px';
    setTimeout(function () {
      el.style.outline = prev.outline;
      el.style.outlineOffset = prev.outlineOffset;
      el.style.transition = prev.transition;
    }, 1800);
  });
})();`;

// ─── Style-select injection script ───────────────────────────────────────────

const STYLE_SELECT_JS = `(function () {
  // SECTION_SEL: DOM をスキャンして実際に存在する lp-* セクションクラスを動的に収集する。
  // AI が生成したカスタムクラス（.lp-price, .lp-plan 等）も含める。
  // ネスト構造（section/article が lp-wrapper の直接子の内側にある場合）にも対応する。
  var SECTION_SEL = (function() {
    var wrapper = document.querySelector('.lp-wrapper') || document.body;
    var sels = [];
    // lp-wrapper 内の全子孫を一括スキャン。
    // 「lp-WORD」2パーツ形式のクラスのみセクションとして登録する。
    // lp-hero-btn, lp-solution-card などの 3パーツ以上はカード/サブ要素なので除外。
    // これによりタグ名・ネスト深さに依存せず確実に検出できる。
    var allEls = wrapper.querySelectorAll('*');
    Array.prototype.forEach.call(allEls, function(el) {
      if (!el.classList || !el.classList.length) return;
      el.classList.forEach(function(c) {
        // ^lp-[a-z][a-z0-9]*$ = 「lp-」+英小文字・数字のみ（ハイフンなし）→ 2パーツ確定
        if (/^lp-[a-z][a-z0-9]*$/.test(c) && sels.indexOf('.' + c) === -1) {
          sels.push('.' + c);
        }
      });
    });
    // フォールバック: 静的リストをマージ（DOM スキャンが空の場合の保険）
    var fixed = 'lp-hero,lp-problem,lp-reason,lp-service,lp-testimonial,lp-cta,lp-faq,lp-gallery,lp-map,lp-contact,lp-voices,lp-beforeafter,lp-linecta,lp-fixedcta,lp-imgblock,lp-wrapper,lp-freeblock,lp-customhtml'.split(',');
    fixed.forEach(function(c) { if (sels.indexOf('.' + c) === -1) sels.push('.' + c); });
    var joined = sels.join(',');
    return joined;
  })();

  var st = document.createElement('style');
  st.setAttribute('data-lp-vs','1');
  st.textContent = [
    '.lp-vs-h{outline:2px dashed rgba(99,102,241,.55)!important;outline-offset:3px!important;cursor:pointer!important;}',
    '.lp-vs-a{outline:2px solid #00AFCC!important;outline-offset:2px!important;}'
  ].join('');
  document.head.appendChild(st);

  var activeEl = null;

  // ─── セクション選択バッジ ────────────────────────────────────────────────────
  // 非セクション要素（テキスト・見出し等）にホバーしたとき、親セクション上部に
  // 「▣ セクションを選択」バッジを表示。クリックでセクションパネルに直接遷移する。
  var _sBadge = document.createElement('div');
  _sBadge.setAttribute('data-lp-vs','1');
  _sBadge.style.cssText='position:fixed;z-index:999999;background:#6366f1;color:#fff;font:600 10px/1.2 system-ui,sans-serif;padding:3px 9px;border-radius:0 0 6px 6px;cursor:pointer;display:none;white-space:nowrap;pointer-events:auto;user-select:none;box-shadow:0 2px 6px rgba(0,0,0,.18);';
  _sBadge.textContent='▣ セクションを選択';
  document.body.appendChild(_sBadge);
  var _sBadgeSec=null, _sBadgeOver=false;
  function _showBadge(sec){
    _sBadgeSec=sec;
    var r=sec.getBoundingClientRect();
    _sBadge.style.left=(r.left+8)+'px';
    _sBadge.style.top=Math.max(0,r.top)+'px';
    _sBadge.style.display='block';
  }
  function _hideBadge(force){
    if(force||!_sBadgeOver){_sBadge.style.display='none';_sBadgeSec=null;}
  }
  _sBadge.addEventListener('mouseenter',function(){_sBadgeOver=true;});
  _sBadge.addEventListener('mouseleave',function(){_sBadgeOver=false;_hideBadge(true);});
  _sBadge.addEventListener('click',function(e){
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    var sec=_sBadgeSec; if(!sec)return;
    _hideBadge(true);
    if(activeEl){activeEl.classList.remove('lp-vs-a');activeEl=null;}
    var secId=sec.getAttribute('data-element-id');
    if(!secId){secId='el-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6);sec.setAttribute('data-element-id',secId);}
    sec.classList.remove('lp-vs-h');
    var secSt=getStyles(sec);
    sec.classList.add('lp-vs-a');activeEl=sec;
    var secCls=[];sec.classList.forEach(function(c){if(c.startsWith('lp-')&&!c.startsWith('lp-vs'))secCls.push(c);});
    var cl=document.body.cloneNode(true);
    cl.querySelectorAll('script').forEach(function(s){s.parentNode&&s.parentNode.removeChild(s);});
    cl.querySelectorAll('.lp-vs-h,.lp-vs-a').forEach(function(el){el.classList.remove('lp-vs-h');el.classList.remove('lp-vs-a');});
    cl.querySelectorAll('details[open]').forEach(function(d){d.removeAttribute('open');});
    window.parent.postMessage({type:'lp-vs-select',elementType:'section',selector:buildSelector(sec),elementId:secId,tagName:sec.tagName.toLowerCase(),label:(sec.textContent||'').trim().slice(0,40),computedStyles:secSt,lpClasses:secCls,updatedHtml:cl.innerHTML},'*');
  },true);
  window.addEventListener('scroll',function(){
    if(_sBadgeSec&&_sBadge.style.display!=='none'){
      var r=_sBadgeSec.getBoundingClientRect();
      _sBadge.style.left=(r.left+8)+'px';
      _sBadge.style.top=Math.max(0,r.top)+'px';
    }
  },true);

  // カード系要素の判定
  // CARD_TYPES: lp-X-{キーワード} の末尾パターン
  var CARD_TYPES = ['card','item','box','panel','block','featured','highlight','special','recommend','popular','main','pickup','plan'];
  function isCardEl(el) {
    var t = el.tagName;
    if (t !== 'DIV' && t !== 'ARTICLE' && t !== 'LI') return false;
    var classes = el.className && typeof el.className === 'string' ? el.className.split(' ') : [];
    var lpCls = classes.filter(function(c){ return c.startsWith('lp-'); });
    if (!lpCls.length) return false;
    // ① キーワードマッチ: lp-X-{CARD_TYPE} パターン（SECTION_SEL 依存なし）
    if (lpCls.some(function(c){
      var p = c.split('-');
      return p.length >= 3 && CARD_TYPES.indexOf(p[p.length - 1]) !== -1;
    })) return true;
    // ② CSS フォールバック: 3パーツ以上のクラスを持ち、見た目がカードらしい要素
    //    2パーツ (lp-price 等セクション div) は除外
    if (!lpCls.some(function(c){ return c.split('-').length >= 3; })) return false;
    if (!el.parentElement) return false;
    try {
      var cs = window.getComputedStyle(el);
      if (parseFloat(cs.borderTopWidth) > 0) return true;
      if (cs.boxShadow && cs.boxShadow !== 'none') return true;
      var bg = cs.backgroundColor;
      if (!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') return false;
      // 親と異なる背景色を持つ（例：白セクション内のベージュカード）
      return bg !== window.getComputedStyle(el.parentElement).backgroundColor;
    } catch(e) {}
    return false;
  }

  // p / li 以外の div / span / small がテキストコンテナかを判定する
  // 子に P・H1-H6・DIV・UL・OL などの「構造要素」を持たず、テキストがある要素
  // ※クラスなし <div>テキスト</div> も対象（BEMクラスは不問）
  var TEXT_STRUCT = {P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,DIV:1,UL:1,OL:1,SECTION:1,ARTICLE:1,FIGURE:1,FORM:1,TABLE:1};
  function isTextContainer(el) {
    if (!el.textContent || !el.textContent.trim()) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (TEXT_STRUCT[el.children[i].tagName]) return false;
    }
    return true;
  }

  function findTarget(el) {
    if (!el || el === document.body || el === document.documentElement) return null;
    if (el.hasAttribute && el.hasAttribute('data-lp-vs')) return null;
    var btn = el.closest && el.closest('a, button');
    if (btn && btn !== document.body) return btn;
    var h = el.closest && el.closest('h1,h2,h3,h4,h5,h6');
    if (h) return h;
    if (el.tagName === 'IMG') return el;

    // Before/After 画像プレースホルダー（.lp-ba-img の中をクリックしたとき）
    var baImg = el.closest && el.closest('.lp-ba-img');
    if (baImg) return baImg;

    // ① p / li → カード優先、なければテキスト要素
    var p = el.closest && el.closest('p, li');
    if (p && (p.tagName !== 'LI' || !isCardEl(p))) {
      var pParent = p.parentElement;
      while (pParent && pParent !== document.body) {
        if (isCardEl(pParent)) return pParent;
        if (pParent.matches && pParent.matches(SECTION_SEL)) break;
        pParent = pParent.parentElement;
      }
      return p;
    }

    // ② div / span / small などテキストコンテナ要素
    //    クラスなし <div>テキスト</div> や <div class="lp-hero-body">テキスト</div> も対象
    //    セクション内にある場合のみ対象とする
    var divEl = el;
    while (divEl && divEl !== document.body) {
      if (divEl.matches && divEl.matches(SECTION_SEL)) break;
      var dtag = divEl.tagName;
      if ((dtag === 'DIV' || dtag === 'SPAN' || dtag === 'SMALL') &&
          !isCardEl(divEl) && isTextContainer(divEl) &&
          divEl.closest && divEl.closest(SECTION_SEL)) {
        var divParent = divEl.parentElement;
        while (divParent && divParent !== document.body) {
          if (isCardEl(divParent)) return divParent;
          if (divParent.matches && divParent.matches(SECTION_SEL)) break;
          divParent = divParent.parentElement;
        }
        return divEl;
      }
      divEl = divEl.parentElement;
    }

    // ③ カード・枠・ボックス（section 手前で停止）
    var cardCheck = el;
    while (cardCheck && cardCheck !== document.body) {
      if (isCardEl(cardCheck)) return cardCheck;
      if (cardCheck.matches && cardCheck.matches(SECTION_SEL)) break;
      cardCheck = cardCheck.parentElement;
    }
    // ④ SECTION_SEL に含まれない section/article タグを独立したセクションとして扱う（保険）
    // SECTION_SEL の querySelectorAll スキャンで拾えなかった要素（動的追加等）に対応
    var secFallback = el;
    while (secFallback && secFallback !== document.body) {
      if (secFallback.matches && secFallback.matches(SECTION_SEL)) break;
      var stag = secFallback.tagName;
      if ((stag === 'SECTION' || stag === 'ARTICLE') && !isCardEl(secFallback)) {
        return secFallback;
      }
      secFallback = secFallback.parentElement;
    }
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
    // Before/After 画像プレースホルダー（isTextContainer より先に判定しないと 'text' になる）
    if (el.classList && el.classList.contains('lp-ba-img')) return 'img-placeholder';
    // div/span/small でテキストコンテナと判定されたもの
    if ((t === 'div' || t === 'span' || t === 'small') && isTextContainer(el)) return 'text';
    if (isCardEl(el)) return 'card';
    return 'section';
  }

  function buildSelector(el) {
    // data-element-id があれば常に一意識別（画像・見出し・テキスト共通）
    var elId = el.getAttribute('data-element-id');
    if (elId) {
      return '[data-element-id="' + elId + '"]';
    }
    var t = el.tagName.toLowerCase();
    var lpCls = [];
    el.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) lpCls.push(c); });
    // 複数の lp-* クラスがある場合は複合セレクターにする（例: .lp-fcta-btn.lp-fcta-line）
    // これにより固定CTAバーの各ボタンが独立したセレクターを持ち、色変更が他のボタンに影響しない
    if (lpCls.length) return lpCls.map(function(c) { return '.' + c; }).join('');
    var sec = el.closest && el.closest(SECTION_SEL);
    if (sec) {
      var secCls = [];
      sec.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) secCls.push(c); });
      if (secCls.length) return '.' + secCls[0] + ' ' + t;
    }
    return t;
  }

  function getStyles(el) {
    // 選択ハイライトクラスを一時的に外してから取得する（rgba overlay が背景色を汚染するのを防ぐ）
    var hadA = el.classList.contains('lp-vs-a');
    var hadH = el.classList.contains('lp-vs-h');
    if (hadA) el.classList.remove('lp-vs-a');
    if (hadH) el.classList.remove('lp-vs-h');
    var cs = window.getComputedStyle(el);
    // isClearBg: 透明・無色・極低アルファ（lp-vs-a の rgba(99,102,241,.05) 等）を "なし" として扱う
    function isClearBg(v) {
      if (!v || v === 'transparent' || v === 'rgba(0, 0, 0, 0)') return true;
      if (/^rgba?\s*\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)$/.test((v||'').trim())) return true;
      // rgba で alpha < 0.15 は事実上透明（lp-vs-a のオーバーレイ色が紛れ込んでも除去できる）
      var am = (v||'').match(/^rgba\s*\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)/);
      if (am && parseFloat(am[1]) < 0.15) return true;
      return false;
    }
    function firstColor(v) {
      if (!v || v === 'none') return null;
      var m = (v||'').match(/rgba?\s*\([^)]+\)|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}\b/);
      return m ? m[0] : null;
    }
    // window.__LP_CSS__ に注入されたCSSテキストを直接解析して背景色を取得
    // 複数 lp-* クラスを全て検索し、CSS ソース内で最も後ろに登場したルールを採用する。
    // これにより CSS のカスケード（同詳細度なら後勝ち）を正確に再現できる。
    function getBgFromCssText(target) {
      try {
        var cssText = (typeof window.__LP_CSS__ === 'string') ? window.__LP_CSS__ : '';
        var lpClasses = [];
        target.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) lpClasses.push(c); });
        if (!lpClasses.length) return null;
        var bestFound = null;
        var bestPos = -1;
        for (var ci = 0; ci < lpClasses.length; ci++) {
          var lpClass = lpClasses[ci];
          // 正確なセレクター（.lp-hero { のみ、.lp-hero-inner 等は除外）
          var selRe = new RegExp('(?:^|[^\\w-])(\\.' + lpClass + ')\\s*\\{([^}]+)\\}', 'gm');
          var match;
          while ((match = selRe.exec(cssText)) !== null) {
            var pos = match.index;
            var block = match[2];
            var blockFound = null;
            // background-color を先に確認（同ブロック内では background shorthand が後勝ち）
            var m1 = block.match(/background-color\s*:\s*([^;!}]+)/);
            if (m1) { var v1 = m1[1].trim(); if (!isClearBg(v1)) blockFound = v1; }
            // background shorthand（gradient含む）— 同ブロック内で background-color を上書き
            var m2 = block.match(/(?<![a-z-])background\s*:\s*([^;!}]+)/);
            if (m2) { var gc = firstColor(m2[1].trim()); if (gc && !isClearBg(gc)) blockFound = gc; }
            // CSS ソース内でより後ろにあるブロックを優先
            if (blockFound && pos > bestPos) { bestFound = blockFound; bestPos = pos; }
          }
        }
        return bestFound;
      } catch(e) { return null; }
    }
    // 要素自身 → backgroundImage → CSSテキスト直接解析 → 祖先遡り の順で背景色を解決
    var rawBgColor = cs.backgroundColor;
    var bgColor = rawBgColor;
    if (isClearBg(bgColor)) { bgColor = firstColor(cs.backgroundImage) || ''; }
    if (isClearBg(bgColor)) { bgColor = getBgFromCssText(el) || ''; }
    if (isClearBg(bgColor)) {
      var node = el.parentElement;
      while (node) {
        var ncs = window.getComputedStyle(node);
        var pb = ncs.backgroundColor;
        if (!isClearBg(pb)) { bgColor = pb; break; }
        var pc = firstColor(ncs.backgroundImage);
        if (pc && !isClearBg(pc)) { bgColor = pc; break; }
        var pr = getBgFromCssText(node);
        if (pr) { bgColor = pr; break; }
        if (node === document.documentElement) break;
        node = node.parentElement;
      }
    }
    // rgb(... ) の閉じ括弧が欠ける場合の安全策（まれに firstColor が truncate した値を返す）
    if (bgColor && bgColor.startsWith('rgb') && !bgColor.endsWith(')')) { bgColor = bgColor + ')'; }
    var finalBg = isClearBg(bgColor) ? 'rgb(255, 255, 255)' : bgColor;
    var result = {
      color: cs.color, backgroundColor: finalBg,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight,
      lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing,
      textAlign: cs.textAlign, borderRadius: cs.borderRadius,
      paddingTop: cs.paddingTop, paddingRight: cs.paddingRight,
      paddingBottom: cs.paddingBottom, paddingLeft: cs.paddingLeft,
      boxShadow: cs.boxShadow, maxWidth: cs.maxWidth,
      textShadow: cs.textShadow, width: cs.width, minHeight: cs.minHeight,
      borderWidth: cs.borderTopWidth,
      borderColor: cs.borderTopColor,
      borderStyle: cs.borderTopStyle
    };
    if (hadA) el.classList.add('lp-vs-a');
    if (hadH) el.classList.add('lp-vs-h');
    return result;
  }

  document.addEventListener('mouseover', function(e) {
    var t = findTarget(e.target);
    document.querySelectorAll('.lp-vs-h').forEach(function(el) { el.classList.remove('lp-vs-h'); });
    if (t && t !== activeEl) t.classList.add('lp-vs-h');
    // セクション選択バッジ: 非セクション要素ホバー時に親セクション上部へ表示
    if (t && getType(t) !== 'section') {
      var ps = t.closest && t.closest(SECTION_SEL);
      if (ps) _showBadge(ps); else _hideBadge();
    } else {
      _hideBadge();
    }
  });
  document.addEventListener('mouseout', function(e) {
    var t = findTarget(e.target);
    if (t && t !== activeEl) t.classList.remove('lp-vs-h');
    _hideBadge();
  });

  // キャプチャフェーズで登録することで、子要素の stopPropagation に関係なく必ずクリックを補足する
  document.addEventListener('click', function(e) {
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
    // <summary> クリック時は <details> の開閉をトグル（preventDefault で止まるため手動で）
    var closestSum = e.target && e.target.closest && e.target.closest('summary');
    if (closestSum) {
      var det = closestSum.closest('details');
      if (det) det.open = !det.open;
    }
    var t = findTarget(e.target);
    if (activeEl) { activeEl.classList.remove('lp-vs-a'); activeEl = null; }
    if (!t) { window.parent.postMessage({ type: 'lp-vs-deselect' }, '*'); return; }

    // data-element-id を付与（挿入済み画像は既存 ID を維持、それ以外は新規生成）
    var elementId = t.getAttribute('data-element-id');
    if (!elementId) {
      elementId = 'el-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
      t.setAttribute('data-element-id', elementId);
    }

    // lp-vs-h を除去し、スタイル取得を lp-vs-a 付与より前に行う。
    // lp-vs-a は background:rgba(99,102,241,.05)!important を持つため、
    // 付与後に getComputedStyle を呼ぶとブラウザのスタイル再計算タイミング次第で
    // 誤った背景色（#6366f1）が返ることがある。先に取得することで確実に正しい色を得る。
    t.classList.remove('lp-vs-h');
    var styles = getStyles(t);

    t.classList.add('lp-vs-a');
    activeEl = t;

    // result.html に data-element-id を同期するためのクリーンな HTML スナップショット
    // （注入したスクリプト・lp-vs-* クラスを除去してから送信）
    var clone = document.body.cloneNode(true);
    clone.querySelectorAll('script').forEach(function(s) { s.parentNode && s.parentNode.removeChild(s); });
    clone.querySelectorAll('.lp-vs-h,.lp-vs-a').forEach(function(el) {
      el.classList.remove('lp-vs-h');
      el.classList.remove('lp-vs-a');
    });
    // <details open> を保存しない
    clone.querySelectorAll('details[open]').forEach(function(d) { d.removeAttribute('open'); });
    // 要素の lp-* クラス一覧を収集（背景色 CSS 解析で使用）
    var lpClasses = [];
    t.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) lpClasses.push(c); });
    // 親セクションの lp-* クラスを収集（セクション背景色編集ボタン用）
    var parentSec = t.closest && t.closest(SECTION_SEL);
    var parentSectionLpClasses = [];
    if (parentSec && parentSec !== t) {
      parentSec.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) parentSectionLpClasses.push(c); });
    }
    window.parent.postMessage({
      type: 'lp-vs-select',
      elementType: getType(t),
      selector: buildSelector(t),
      elementId: elementId,
      tagName: t.tagName.toLowerCase(),
      label: (t.textContent || '').trim().slice(0, 40),
      computedStyles: styles,
      lpClasses: lpClasses,
      parentSectionLpClasses: parentSectionLpClasses,
      updatedHtml: clone.innerHTML
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
    // 親セクションをプログラム的に選択する
    if (e.data && e.data.type === 'lp-vs-select-section') {
      var sec = null;
      var classes = e.data.lpClasses;
      if (classes && classes.length) {
        for (var ci = 0; ci < classes.length; ci++) {
          try {
            var found = document.querySelector('.' + classes[ci]);
            // SECTION_SEL に含まれていれば優先。含まれなくても lp-* クラスを持つ
            // ブロック要素なら「ネストdivセクション」として許容する。
            if (!found) continue;
            var isSec = found.matches(SECTION_SEL);
            if (!isSec) {
              var ft = found.tagName;
              isSec = (ft === 'DIV' || ft === 'SECTION' || ft === 'ARTICLE') &&
                       found.className && typeof found.className === 'string' &&
                       found.className.split(' ').some(function(c){ return /^lp-[a-z]/.test(c) && !c.startsWith('lp-vs'); });
            }
            if (isSec) { sec = found; break; }
          } catch(err2) {}
        }
      }
      if (!sec) return;
      if (activeEl) { activeEl.classList.remove('lp-vs-a'); activeEl = null; }
      var secId = sec.getAttribute('data-element-id');
      if (!secId) {
        secId = 'el-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 6);
        sec.setAttribute('data-element-id', secId);
      }
      sec.classList.remove('lp-vs-h');
      var secStyles = getStyles(sec);
      sec.classList.add('lp-vs-a');
      activeEl = sec;
      var secLpCls = [];
      sec.classList.forEach(function(c) { if (c.startsWith('lp-') && !c.startsWith('lp-vs')) secLpCls.push(c); });
      var clone2 = document.body.cloneNode(true);
      clone2.querySelectorAll('script').forEach(function(s) { s.parentNode && s.parentNode.removeChild(s); });
      clone2.querySelectorAll('.lp-vs-h,.lp-vs-a').forEach(function(el) { el.classList.remove('lp-vs-h'); el.classList.remove('lp-vs-a'); });
      clone2.querySelectorAll('details[open]').forEach(function(d) { d.removeAttribute('open'); });
      window.parent.postMessage({
        type: 'lp-vs-select',
        elementType: 'section',
        selector: buildSelector(sec),
        elementId: secId,
        tagName: sec.tagName.toLowerCase(),
        label: (sec.textContent || '').trim().slice(0, 40),
        computedStyles: secStyles,
        lpClasses: secLpCls,
        updatedHtml: clone2.innerHTML
      }, '*');
    }
  });
})();`;

// Block-level tags that prevent an element from being leaf-editable
const EDIT_JS = `(function () {
  var BLOCK = { DIV:1,SECTION:1,ARTICLE:1,ASIDE:1,NAV:1,HEADER:1,FOOTER:1,
                MAIN:1,FIGURE:1,UL:1,OL:1,TABLE:1,TBODY:1,THEAD:1,TR:1,FORM:1 };
  var SEL = 'h1,h2,h3,h4,h5,h6,p,button,a,li,span,strong,em,small,label,dt,dd,th,td,blockquote,summary';
  var cur = null;

  /* ── inject styles ── */
  var st = document.createElement('style');
  st.setAttribute('data-lp-editor','1');
  st.textContent = [
    '.lp-eh { outline:2px dashed rgba(99,102,241,.65)!important; outline-offset:2px!important; cursor:text!important; }',
    '.lp-ea { outline:2px solid #00AFCC!important; outline-offset:2px!important; border-radius:2px!important; }'
  ].join('');
  document.head.appendChild(st);

  /* ── helpers ── */
  function isLeaf(el) {
    for (var i = 0; i < el.children.length; i++) {
      if (BLOCK[el.children[i].tagName]) return false;
    }
    return true;
  }
  // div がテキストコンテナか（P/H1-H6/DIV/UL/OL 等の構造子を持たず、テキストがある）
  // クラスなし <div>テキスト</div> も対象（BEMクラス不問）
  var EDIT_TEXT_STRUCT = {P:1,H1:1,H2:1,H3:1,H4:1,H5:1,H6:1,DIV:1,UL:1,OL:1,SECTION:1,ARTICLE:1,FIGURE:1,FORM:1,TABLE:1};
  function isTextLeaf(el) {
    if (!el.textContent || !el.textContent.trim()) return false;
    for (var i = 0; i < el.children.length; i++) {
      if (EDIT_TEXT_STRUCT[el.children[i].tagName]) return false;
    }
    return true;
  }

  function findTarget(node) {
    var el = node;
    while (el && el !== document.body) {
      // 通常の編集対象（h/p/a/button/li/span/small 等）
      if (el.matches && el.matches(SEL) && isLeaf(el) && !el.getAttribute('data-lp-editor')) return el;
      // div もテキスト編集対象に（クラスなし含む）
      // isTextLeaf で「構造子なし＋テキストあり」を判定して安全に絞り込む
      if (el.tagName === 'DIV' && !el.getAttribute('data-lp-editor') && isTextLeaf(el)) return el;
      el = el.parentElement;
    }
    return null;
  }

  /* ── hover ── */
  document.addEventListener('mouseover', function(e) {
    var el = findTarget(e.target);
    if (el && el !== cur) el.classList.add('lp-eh');
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
    // <summary> クリック時は親 <details> の開閉もトグル（preventDefault で止まるため手動で）
    if (el.tagName === 'SUMMARY') {
      var det = el.closest && el.closest('details');
      if (det) det.open = !det.open;
    }
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
    // <details open> を保存しない（開いた状態をHTMLに残さない）
    clone.querySelectorAll('details[open]').forEach(function(d) { d.removeAttribute('open'); });
    window.parent.postMessage({ type: 'lp-html-update', html: clone.innerHTML }, '*');
  }
})();`;

export interface ButtonImageOverride {
  selector: string;
  config: ButtonImageConfig;
}

interface Props {
  html: string;
  css: string;
  mode?: PreviewMode;
  imageOverrides?: UploadedImage[];
  onHtmlChange?: (html: string) => void;
  /**
   * data-element-id 付与など Undo スタックに残さない HTML 同期に使用。
   * applyHtml(html, false) に対応する。
   */
  onHtmlSilentUpdate?: (html: string) => void;
  iframeHeight?: number;
  // Style editing
  editMode?: "text" | "style";
  onElementSelect?: (el: SelectedElement | null) => void;
  selectedSelector?: string | null;
  // Button image replacement
  buttonImageOverrides?: ButtonImageOverride[];
  // Font
  fontGoogleUrl?: string;
  /** CSS font-family 値（フォールバック込み）。末尾 <style> で最優先上書きに使用 */
  fontFamily?: string;
}

/** 親コンポーネントから呼び出せる命令型 API */
export interface LPPreviewHandle {
  /** プレビュー内の .lp-{sectionId} 要素へスムーズスクロール＋ハイライト */
  scrollToSection: (sectionId: string) => void;
  /**
   * セクション並び替え・削除など「HTML だけ変わる」操作で
   * skipNextRef をリセットしつつ即座に iframe を更新する。
   * React の非同期チェーン（buildContent effect）を待たないため確実。
   */
  forceRefreshWithHtml: (newHtml: string) => void;
  /** lp-* クラスで指定したセクションをプログラム的に選択する（背景色編集ボタン等から呼び出し） */
  selectSection: (lpClasses: string[]) => void;
}

const LPPreview = forwardRef<LPPreviewHandle, Props>(function LPPreview({
  html,
  css,
  mode = "desktop",
  imageOverrides = [],
  onHtmlChange,
  onHtmlSilentUpdate,
  iframeHeight = 600,
  editMode = "text",
  onElementSelect,
  selectedSelector,
  buttonImageOverrides = [],
  fontGoogleUrl,
  fontFamily,
}: Props, ref) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const skipNextRef = useRef(false);
  const selectedSelectorRef = useRef<string | null>(selectedSelector ?? null);
  // スクロール保持：前回の html / editMode を記憶し CSS だけ変わった場合を検出
  const prevHtmlRef = useRef(html);
  const prevEditModeRef = useRef(editMode);
  const editable = !!onHtmlChange;

  // ─── message handler を安定させるための refs ───────────────────────────────
  // onHtmlSilentUpdate・onElementSelect はインライン関数で毎レンダー変化するため
  // useEffect の deps に含めると頻繁にリスナーが解除→再登録され、
  // ちょうどその隙間に postMessage が届いたときにドロップする問題を防ぐ
  const editModeRef = useRef(editMode);
  const editableRef = useRef(editable);
  const onHtmlChangeRef = useRef(onHtmlChange);
  const onHtmlSilentUpdateRef = useRef(onHtmlSilentUpdate);
  const onElementSelectRef = useRef(onElementSelect);
  useEffect(() => { editModeRef.current = editMode; });
  useEffect(() => { editableRef.current = editable; });
  useEffect(() => { onHtmlChangeRef.current = onHtmlChange; });
  useEffect(() => { onHtmlSilentUpdateRef.current = onHtmlSilentUpdate; });
  useEffect(() => { onElementSelectRef.current = onElementSelect; });

  useEffect(() => {
    selectedSelectorRef.current = selectedSelector ?? null;
  }, [selectedSelector]);

  const buildContent = useCallback((htmlOverride?: string) => {
    const effectiveHtml = htmlOverride ?? html;

    // 吹き出しセクション（data-bubble-layout="1"）を検出
    const bubbleIds = new Set<string>();
    try {
      const doc = new DOMParser().parseFromString(effectiveHtml, "text/html");
      doc.querySelectorAll("[data-bubble-layout]").forEach((el) => {
        for (const cls of Array.from(el.classList)) {
          const m = cls.match(/^lp-([a-z0-9-]+)$/);
          if (m) { bubbleIds.add(m[1]); break; }
        }
      });
    } catch { /* ignore */ }

    const imageCss = imageOverrides
      .map((img) => {
        const sel = placementToSelector(img.placement);
        if (img.placement !== "other" && bubbleIds.has(img.placement)) {
          // 吹き出しセクション：人物画像を背景に contain で中央表示
          return `${sel} { background-image: url('${img.url}') !important; background-size: contain !important; background-position: center !important; background-repeat: no-repeat !important; }`;
        }
        return `${sel} { background-image: url('${img.url}') !important; background-size: cover !important; background-position: center !important; }`;
      })
      .join("\n");

    // ─── 編集モード専用：吹き出しセクションの背景画像ガイド ───────────────────
    // エクスポートCSSには含まれない。背景画像未設定時のみ薄いヒントを表示する。
    const BUBBLE_GUIDE_CSS = editable || editMode === "style" ? `
.lp-fb-inner:not(:has(> [data-lp-fb-el])) {
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(99,102,241,.35);
  border-radius: 12px;
  color: rgba(99,102,241,.6);
  font-size: 0.85rem;
  font-family: sans-serif;
}
.lp-fb-inner:not(:has(> [data-lp-fb-el]))::after {
  content: "⬜  左パネルの「空セクション編集」から要素を追加";
  pointer-events: none;
}
[data-bubble-layout][data-no-bg] [class*="__board"]::after {
  content: "📸  左の「画像設定」で人物の背景画像を設定";
  position: absolute;
  bottom: 1.2rem; left: 50%;
  transform: translateX(-50%);
  background: rgba(255,255,255,0.88);
  border: 1px dashed rgba(0,175,204,0.45);
  color: rgba(0,120,145,0.75);
  padding: 0.35rem 1rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-family: sans-serif;
  white-space: nowrap;
  pointer-events: none;
  z-index: 50;
}` : "";

    // 吹き出しセクションの背景画像有無を判定して data-no-bg を付与するスクリプト
    const BUBBLE_GUIDE_JS = editable || editMode === "style" ? `
(function(){
  function applyGuide(){
    document.querySelectorAll('[data-bubble-layout]').forEach(function(sec){
      var bg=window.getComputedStyle(sec).backgroundImage;
      if(!bg||bg==='none'){sec.setAttribute('data-no-bg','1');}
      else{sec.removeAttribute('data-no-bg');}
    });
  }
  applyGuide();
  // MutationObserver で CSS 変化（背景画像設定）にも追従
  var mo=new MutationObserver(function(ml){
    ml.forEach(function(m){if(m.type==='attributes'&&m.attributeName==='style')applyGuide();});
  });
  document.querySelectorAll('[data-bubble-layout]').forEach(function(sec){
    mo.observe(sec,{attributes:true,attributeFilter:['style']});
  });
  // 動的に追加された <style> タグに対応（background-image オーバーライド後）
  var so=new MutationObserver(function(){setTimeout(applyGuide,50);});
  so.observe(document.head,{childList:true,subtree:true});
})();` : "";

    // Style-select mode injects its own script regardless of onHtmlChange
    let editBlock = "";
    if (editMode === "style") {
      editBlock = `\n<script>\n${STYLE_SELECT_JS}\n<` + `/script>`;
    } else if (editable) {
      editBlock = `\n<script>\n${EDIT_JS}\n<` + `/script>`;
    }
    const bubbleGuideBlock = BUBBLE_GUIDE_JS ? `\n<script>\n${BUBBLE_GUIDE_JS}\n<` + `/script>` : "";
    // セクションスクロールは全モードで常時有効
    const scrollBlock = `\n<script>\n${SCROLL_JS}\n<` + `/script>`;

    // ボタン画像置換スクリプト（CSS background-image を使わず <img> タグに直接置換）
    let buttonImgBlock = "";
    if (buttonImageOverrides.length > 0) {
      const scriptData = JSON.stringify(
        buttonImageOverrides.map(({ selector, config: ib }) => ({
          s: selector,
          u: ib.url,
          a: ib.alt,
          w: ib.width,
          h: ib.height,
          r: ib.maintainRatio,
          f: ib.fitMode ?? "cover",
        }))
      );
      const BTN_IMG_JS = `(function(){
var D=${scriptData};
function stripBtn(el){
  el.style.setProperty('background','transparent','important');
  el.style.setProperty('background-color','transparent','important');
  el.style.setProperty('background-image','none','important');
  el.style.setProperty('border','none','important');
  el.style.setProperty('box-shadow','none','important');
  el.style.setProperty('padding','0','important');
  el.style.setProperty('margin','0','important');
  el.style.setProperty('display','inline-block','important');
  el.style.setProperty('line-height','0','important');
  el.style.setProperty('text-decoration','none','important');
  el.style.setProperty('outline','none','important');
}
function stripWrap(el){
  el.style.setProperty('background','transparent','important');
  el.style.setProperty('background-color','transparent','important');
  el.style.setProperty('border','none','important');
  el.style.setProperty('box-shadow','none','important');
}
function run(){D.forEach(function(ov){
  try{
    var el=document.querySelector(ov.s);
    if(!el||el.getAttribute('data-bib'))return;
    var img=document.createElement('img');
    img.src=ov.u; img.alt=ov.a||'';
    var st=['display:block','max-width:100%'];
    var fit=ov.f||'cover';
    st.push('object-fit:'+(fit==='stretch'?'fill':fit));
    if(ov.w&&ov.w!=='auto') st.push('width:'+ov.w);
    if(ov.r){st.push('height:auto');}
    else if(ov.h&&ov.h!=='auto'){st.push('height:'+ov.h);}
    img.setAttribute('style',st.join(';'));
    var tag=el.tagName.toLowerCase();
    if(tag==='a'){
      el.innerHTML='';el.appendChild(img);el.setAttribute('data-bib','1');
      stripBtn(el);
      if(el.parentElement) stripWrap(el.parentElement);
    }else if(tag==='button'){
      var pa=el.parentElement;
      if(pa&&pa.tagName.toLowerCase()==='a'){
        pa.innerHTML='';pa.appendChild(img);pa.setAttribute('data-bib','1');
        stripBtn(pa);
        if(pa.parentElement) stripWrap(pa.parentElement);
      }else{
        var wrap=el.parentElement;
        el.replaceWith(img);
        if(wrap) stripWrap(wrap);
      }
    }else{
      el.innerHTML='';el.appendChild(img);el.setAttribute('data-bib','1');
      stripBtn(el);
      if(el.parentElement) stripWrap(el.parentElement);
    }
  }catch(e){}
});}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',run);}else{run();}
})();`;
      buttonImgBlock = `\n<script>\n${BTN_IMG_JS}\n<` + `/script>`;
    }

    // フォントの<link>タグ：選択フォントが指定されていればそちらを使い、なければNoto Sans JPをデフォルト
    const fontLinkTag = fontGoogleUrl
      ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="${fontGoogleUrl}" rel="stylesheet">`
      : `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@300;400;500;700&display=swap" rel="stylesheet">`;

    // フォントを body 末尾の <style> で上書き。
    // ・head の <style> より source-order が遅い → 同 specificity なら必ず勝つ
    // ・!important 付き → LP 生成 CSS に class-level font-family があっても上書き
    // ・* セレクタは body, body * より汎用だが、末尾配置で specificity 勝負を回避
    const fontOverrideBlock = fontFamily
      ? `\n<style data-lp-font-override>*,*::before,*::after{font-family:${fontFamily}!important}</style>`
      : "";

    const cssVarBlock = `\n<script>window.__LP_CSS__=${JSON.stringify(css)};<` + `/script>`;
    return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
${fontLinkTag}
<style>
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; padding: 0; }
img { max-width: 100%; height: auto; }
${css}
${imageCss}
${BUBBLE_GUIDE_CSS}
</style>
</head>
<body>${effectiveHtml}${scrollBlock}${cssVarBlock}${editBlock}${buttonImgBlock}${bubbleGuideBlock}${fontOverrideBlock}
</body>
</html>`;
  }, [html, css, imageOverrides, editable, editMode, buttonImageOverrides, fontGoogleUrl, fontFamily]);

  useImperativeHandle(ref, () => ({
    scrollToSection: (sectionId: string) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "lp-scroll-to", sectionId },
        "*"
      );
    },
    forceRefreshWithHtml: (newHtml: string) => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      // 直後の buildContent effect が二重更新するのを防ぐ
      skipNextRef.current = true;
      iframe.srcdoc = buildContent(newHtml);
    },
    selectSection: (lpClasses: string[]) => {
      iframeRef.current?.contentWindow?.postMessage(
        { type: "lp-vs-select-section", lpClasses },
        "*"
      );
    },
  }), [buildContent]); // buildContent が変わるたびに最新クロージャを反映

  // Sync iframe content — skip when triggered by our own edit
  // html / editMode が変わらず CSS だけ変わった場合はスクロール位置を保持する
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    // 差分検出（スキップ時も含め常に更新）
    const htmlChanged    = html     !== prevHtmlRef.current;
    const modeChanged    = editMode !== prevEditModeRef.current;
    prevHtmlRef.current    = html;
    prevEditModeRef.current = editMode;

    if (skipNextRef.current) {
      skipNextRef.current = false;
      // HTML が実際に変わった場合（data-element-id 付与など）のみスキップ。
      // CSS のみの変更（ビジュアル編集での色変更等）はスキップしない。
      if (htmlChanged) return;
    }
    const iframe = iframeRef.current;
    if (!iframe) return;

    // モード切替・HTML・CSS 変更すべてでスクロール位置を保持する。
    const scrollY = iframe.contentWindow?.scrollY ?? 0;
    void modeChanged; // 参照を維持（lint 警告抑制）

    iframe.srcdoc = buildContent();

    if (scrollY > 0) {
      iframe.addEventListener("load", () => {
        iframe.contentWindow?.scrollTo(0, scrollY);
      }, { once: true });
    }
  }, [buildContent]); // html/editMode は buildContent 経由で推移的に追跡

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
  // Listen for postMessage from the iframe — マウント時1回だけ登録し、
  // 最新の editMode / callbacks は ref 経由で参照することでドロップを防ぐ
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const em = editModeRef.current;
      const ed = editableRef.current;
      // Text edit updates — ignored in style mode
      if (e.data?.type === "lp-html-update" && em !== "style" && ed) {
        skipNextRef.current = true;
        onHtmlChangeRef.current?.(e.data.html as string);
      }
      if (e.data?.type === "lp-vs-select") {
        // data-element-id が付与された HTML を Undo なしで result.html に同期する。
        // これにより insertImageAdjacentToElement が data-element-id で正確な要素を特定できる。
        if (e.data.updatedHtml && onHtmlSilentUpdateRef.current) {
          skipNextRef.current = true; // iframe を再ロードさせない
          onHtmlSilentUpdateRef.current(e.data.updatedHtml as string);
        }
        onElementSelectRef.current?.({
          type: e.data.elementType,
          selector: e.data.selector,
          elementId: e.data.elementId as string | undefined,
          tagName: e.data.tagName,
          label: e.data.label,
          computedStyles: e.data.computedStyles,
          lpClasses: e.data.lpClasses as string[] | undefined,
          parentSectionLpClasses: e.data.parentSectionLpClasses as string[] | undefined,
        });
      }
      if (e.data?.type === "lp-vs-deselect") {
        onElementSelectRef.current?.(null);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation"
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
});

export default LPPreview;
