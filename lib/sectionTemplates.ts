export interface SectionInput {
  key: string;
  label: string;
  placeholder: string;
  type?: "text" | "tel" | "url" | "email" | "select";
  options?: { value: string; label: string }[];
  dependsOn?: { key: string; value: string };
  required?: boolean;
  defaultValue?: string;
}

export interface SectionTemplate {
  id: string;
  label: string;
  icon: string;
  description: string;
  inputs?: SectionInput[];
  /** body 末尾に挿入（Fixed CTA など） */
  insertAtEnd?: boolean;
  generateHtml: (values: Record<string, string>) => string;
  generateCss: () => string;
}

// ─── Helper ──────────────────────────────────────────────────────────────────

const enc = (s: string) => encodeURIComponent(s);

// ─── Templates ───────────────────────────────────────────────────────────────

export const SECTION_TEMPLATES: SectionTemplate[] = [

  /* ── Google Map ─────────────────────────────────────────────────────────── */
  {
    id: "map",
    label: "Googleマップ",
    icon: "🗺️",
    description: "住所を入力してアクセスマップを表示",
    inputs: [
      { key: "address", label: "住所・地名", placeholder: "東京都渋谷区神南1-1-1", required: true },
      { key: "title", label: "セクション見出し", placeholder: "アクセス", defaultValue: "アクセス" },
    ],
    generateHtml: ({ address = "東京都渋谷区", title = "アクセス" }) => `
<section class="lp-map">
  <div class="lp-map-inner">
    <h2 class="lp-map-title">${title}</h2>
    <div class="lp-map-frame">
      <iframe
        src="https://maps.google.com/maps?q=${enc(address)}&output=embed&hl=ja"
        loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"
      ></iframe>
    </div>
    <p class="lp-map-addr">📍 ${address}</p>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-map { padding: 64px 20px; background: #f9fafb; }
.lp-map-inner { max-width: 900px; margin: 0 auto; text-align: center; }
.lp-map-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 2rem; }
.lp-map-frame { position: relative; padding-bottom: 50%; height: 0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,.1); }
.lp-map-frame iframe { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0; }
.lp-map-addr { margin-top: 1rem; color: #6b7280; font-size: .9rem; }
@media (max-width: 640px) { .lp-map-title { font-size: 1.4rem; } }`,
  },

  /* ── Contact Form ────────────────────────────────────────────────────────── */
  {
    id: "contact",
    label: "お問い合わせフォーム",
    icon: "📝",
    description: "CF7・Formspree・mailtoから送信方式を選択",
    inputs: [
      {
        key: "method",
        label: "フォーム送信方式",
        placeholder: "",
        type: "select",
        defaultValue: "formspree",
        options: [
          { value: "formspree", label: "Formspree（HTML・Netlify対応）" },
          { value: "cf7",       label: "WordPress / Contact Form 7" },
          { value: "mailto",    label: "mailto（メーラー起動）" },
        ],
      },
      {
        key: "formspreeUrl",
        label: "Formspree エンドポイントURL",
        placeholder: "https://formspree.io/f/xxxxxxxx",
        type: "url",
        dependsOn: { key: "method", value: "formspree" },
        required: true,
      },
      {
        key: "cf7Shortcode",
        label: "CF7 ショートコード",
        placeholder: '[contact-form-7 id="123" title="Contact form 1"]',
        dependsOn: { key: "method", value: "cf7" },
        required: true,
      },
      {
        key: "mailtoEmail",
        label: "送信先メールアドレス",
        placeholder: "info@example.com",
        type: "email",
        dependsOn: { key: "method", value: "mailto" },
        required: true,
      },
      {
        key: "title",
        label: "セクション見出し",
        placeholder: "お問い合わせ",
        defaultValue: "お問い合わせ",
      },
      {
        key: "lead",
        label: "リード文",
        placeholder: "お気軽にお問い合わせください。",
        defaultValue: "お気軽にお問い合わせください。2〜3営業日以内にご返信いたします。",
      },
    ],
    generateHtml: (values) => {
      const method       = values.method       || "formspree";
      const title        = values.title        || "お問い合わせ";
      const lead         = values.lead         || "お気軽にお問い合わせください。2〜3営業日以内にご返信いたします。";
      const formspreeUrl = values.formspreeUrl || "https://formspree.io/f/xxxxxxxx";
      const cf7Shortcode = values.cf7Shortcode || '[contact-form-7 id="1" title="Contact form 1"]';
      const mailtoEmail  = values.mailtoEmail  || "info@example.com";

      const commonFields = `
      <div class="lp-cf-row">
        <label class="lp-cf-label">お名前 <span class="lp-cf-req">*</span></label>
        <input class="lp-cf-input" type="text" name="name" placeholder="山田 太郎" required>
      </div>
      <div class="lp-cf-row">
        <label class="lp-cf-label">メールアドレス <span class="lp-cf-req">*</span></label>
        <input class="lp-cf-input" type="email" name="email" placeholder="example@email.com" required>
      </div>
      <div class="lp-cf-row">
        <label class="lp-cf-label">電話番号</label>
        <input class="lp-cf-input" type="tel" name="phone" placeholder="090-0000-0000">
      </div>
      <div class="lp-cf-row">
        <label class="lp-cf-label">お問い合わせ内容 <span class="lp-cf-req">*</span></label>
        <textarea class="lp-cf-textarea" name="message" placeholder="ご質問・ご相談内容をご入力ください" required></textarea>
      </div>`;

      /* ─ CF7 ─ */
      if (method === "cf7") {
        return `
<section class="lp-contact">
  <div class="lp-contact-inner">
    <h2 class="lp-contact-title">${title}</h2>
    <p class="lp-contact-lead">${lead}</p>
    <div class="lp-cf7-wrap">
      <div class="lp-cf7-placeholder">
        <span class="lp-cf7-icon">📋</span>
        <p class="lp-cf7-hint">Contact Form 7</p>
        <code class="lp-cf7-code">${cf7Shortcode}</code>
        <p class="lp-cf7-note">WordPressページではここにフォームが表示されます</p>
      </div>
      <p class="lp-cf7-notwp">⚠️ このフォームは WordPress + Contact Form 7 環境でのみ動作します。通常のHTML・Netlifyでは機能しません。</p>
    </div>
  </div>
</section>`.trim();
      }

      /* ─ mailto ─ */
      if (method === "mailto") {
        return `
<section class="lp-contact">
  <div class="lp-contact-inner">
    <h2 class="lp-contact-title">${title}</h2>
    <p class="lp-contact-lead">${lead}</p>
    <form class="lp-contact-form" action="mailto:${mailtoEmail}" method="post" enctype="text/plain">
      ${commonFields}
      <div class="lp-cf-submit-wrap">
        <button class="lp-cf-submit" type="submit">送信する →</button>
      </div>
    </form>
    <p class="lp-mailto-note">※「送信する」を押すとメーラーが起動します</p>
  </div>
</section>`.trim();
      }

      /* ─ Formspree (default) ─ */
      return `
<section class="lp-contact">
  <div class="lp-contact-inner">
    <h2 class="lp-contact-title">${title}</h2>
    <p class="lp-contact-lead">${lead}</p>
    <form class="lp-contact-form" id="lp-cf-form" action="${formspreeUrl}" method="POST">
      ${commonFields}
      <div class="lp-cf-submit-wrap">
        <button class="lp-cf-submit" type="submit" id="lp-cf-btn">送信する →</button>
      </div>
    </form>
    <div id="lp-cf-success" class="lp-cf-result lp-cf-success" style="display:none">
      <div class="lp-cf-result-icon">✅</div>
      <p class="lp-cf-result-title">送信ありがとうございます！</p>
      <p class="lp-cf-result-sub">担当者よりご連絡いたします。</p>
    </div>
    <div id="lp-cf-error" class="lp-cf-result lp-cf-error-msg" style="display:none">
      <div class="lp-cf-result-icon">⚠️</div>
      <p class="lp-cf-result-title">送信に失敗しました</p>
      <p class="lp-cf-result-sub">しばらくしてからお試しください。</p>
    </div>
  </div>
  <script>
(function(){
  var form = document.getElementById('lp-cf-form');
  var btn  = document.getElementById('lp-cf-btn');
  if (!form || !btn) return;
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    btn.disabled = true;
    btn.textContent = '送信中…';
    fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (j.ok) {
          form.style.display = 'none';
          document.getElementById('lp-cf-success').style.display = 'flex';
        } else {
          document.getElementById('lp-cf-error').style.display = 'flex';
          btn.disabled = false;
          btn.textContent = '送信する →';
        }
      })
      .catch(function(){
        document.getElementById('lp-cf-error').style.display = 'flex';
        btn.disabled = false;
        btn.textContent = '送信する →';
      });
  });
})();
  </script>
</section>`.trim();
    },
    generateCss: () => `
.lp-contact { padding: 64px 20px; background: #fff; }
.lp-contact-inner { max-width: 620px; margin: 0 auto; }
.lp-contact-title { font-size: 1.75rem; font-weight: 700; text-align: center; margin: 0 0 .5rem; }
.lp-contact-lead { text-align: center; color: #6b7280; font-size: .9rem; margin: 0 0 2.5rem; }
.lp-contact-form { display: flex; flex-direction: column; gap: 1.25rem; }
.lp-cf-row { display: flex; flex-direction: column; gap: .4rem; }
.lp-cf-label { font-size: .875rem; font-weight: 600; color: #374151; }
.lp-cf-req { color: #ef4444; }
.lp-cf-input, .lp-cf-textarea {
  width: 100%; padding: .75rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 8px;
  font-size: 1rem; font-family: inherit; box-sizing: border-box; transition: border-color .2s;
}
.lp-cf-input:focus, .lp-cf-textarea:focus { outline: none; border-color: #6366f1; }
.lp-cf-textarea { min-height: 140px; resize: vertical; }
.lp-cf-submit-wrap { text-align: center; margin-top: .5rem; }
.lp-cf-submit {
  padding: .875rem 3rem; background: #6366f1; color: #fff; border: none;
  border-radius: 8px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: background .2s;
}
.lp-cf-submit:hover { background: #4f46e5; }
.lp-cf-submit:disabled { opacity: .6; cursor: not-allowed; }
.lp-cf-result {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 3rem 1rem; text-align: center; gap: .5rem;
}
.lp-cf-result-icon { font-size: 2.5rem; }
.lp-cf-result-title { font-size: 1.25rem; font-weight: 700; margin: 0; color: #111827; }
.lp-cf-result-sub { font-size: .9rem; color: #6b7280; margin: 0; }
.lp-cf-error-msg .lp-cf-result-title { color: #dc2626; }
.lp-cf7-wrap { display: flex; flex-direction: column; gap: 1rem; }
.lp-cf7-placeholder {
  display: flex; flex-direction: column; align-items: center; gap: .5rem;
  padding: 2rem 1.5rem; border: 2px dashed #c7d2fe; border-radius: 12px; background: #eef2ff;
  text-align: center;
}
.lp-cf7-icon { font-size: 2rem; }
.lp-cf7-hint { font-size: .8rem; font-weight: 700; color: #6366f1; text-transform: uppercase; letter-spacing: .05em; margin: 0; }
.lp-cf7-code {
  display: block; padding: .5rem .875rem; background: #1e1b4b; color: #a5b4fc;
  border-radius: 6px; font-size: .8rem; font-family: monospace; word-break: break-all;
}
.lp-cf7-note { font-size: .78rem; color: #6b7280; margin: 0; }
.lp-cf7-notwp {
  padding: .75rem 1rem; background: #fff7ed; border: 1px solid #fed7aa;
  border-radius: 8px; font-size: .82rem; color: #92400e; margin: 0;
}
.lp-mailto-note { margin-top: 1rem; text-align: center; font-size: .82rem; color: #9ca3af; }`,
  },

  /* ── FAQ ─────────────────────────────────────────────────────────────────── */
  {
    id: "faqblock",
    label: "FAQ",
    icon: "❓",
    description: "よくある質問・回答のアコーディオン",
    generateHtml: () => `
<section class="lp-faqblock">
  <div class="lp-faqb-inner">
    <h2 class="lp-faqb-title">よくある質問</h2>
    <div class="lp-faqb-list">
      <details class="lp-faqb-item">
        <summary class="lp-faqb-q">Q. サービスの申し込み方法を教えてください</summary>
        <div class="lp-faqb-a">A. お問い合わせフォームまたはLINEよりお気軽にご連絡ください。担当者よりご連絡いたします。</div>
      </details>
      <details class="lp-faqb-item">
        <summary class="lp-faqb-q">Q. 料金はどのくらいかかりますか？</summary>
        <div class="lp-faqb-a">A. ご要望や内容によって異なります。まずは無料相談にてご確認ください。</div>
      </details>
      <details class="lp-faqb-item">
        <summary class="lp-faqb-q">Q. 対応エリアはどこですか？</summary>
        <div class="lp-faqb-a">A. 全国対応しております。オンラインでのご相談も可能です。</div>
      </details>
      <details class="lp-faqb-item">
        <summary class="lp-faqb-q">Q. キャンセルはできますか？</summary>
        <div class="lp-faqb-a">A. ご予約の変更・キャンセルは〇日前までお受けしております。詳しくはお問い合わせください。</div>
      </details>
    </div>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-faqblock { padding: 64px 20px; background: #f9fafb; }
.lp-faqb-inner { max-width: 760px; margin: 0 auto; }
.lp-faqb-title { font-size: 1.75rem; font-weight: 700; text-align: center; margin: 0 0 2.5rem; }
.lp-faqb-list { display: flex; flex-direction: column; gap: .75rem; }
.lp-faqb-item { background: #fff; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; }
.lp-faqb-q {
  display: flex; justify-content: space-between; align-items: center;
  padding: 1.1rem 1.25rem; font-weight: 600; font-size: .95rem; cursor: pointer; list-style: none;
  color: #111827;
}
.lp-faqb-q::after { content: '+'; font-size: 1.25rem; color: #6366f1; flex-shrink: 0; }
.lp-faqb-item[open] .lp-faqb-q::after { content: '−'; }
.lp-faqb-a { padding: 0 1.25rem 1.1rem; font-size: .9rem; color: #4b5563; line-height: 1.7; }`,
  },

  /* ── Gallery ─────────────────────────────────────────────────────────────── */
  {
    id: "gallery",
    label: "ギャラリー",
    icon: "🖼️",
    description: "施工事例・写真ギャラリー（6枚グリッド）",
    generateHtml: () => `
<section class="lp-gallery">
  <div class="lp-gallery-inner">
    <h2 class="lp-gallery-title">ギャラリー</h2>
    <p class="lp-gallery-sub">施工事例・サービスの様子をご覧ください</p>
    <div class="lp-gallery-grid">
      <div class="lp-gallery-item"><span>写真 1</span></div>
      <div class="lp-gallery-item"><span>写真 2</span></div>
      <div class="lp-gallery-item"><span>写真 3</span></div>
      <div class="lp-gallery-item"><span>写真 4</span></div>
      <div class="lp-gallery-item"><span>写真 5</span></div>
      <div class="lp-gallery-item"><span>写真 6</span></div>
    </div>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-gallery { padding: 64px 20px; background: #fff; }
.lp-gallery-inner { max-width: 960px; margin: 0 auto; text-align: center; }
.lp-gallery-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 .5rem; }
.lp-gallery-sub { color: #6b7280; font-size: .9rem; margin: 0 0 2rem; }
.lp-gallery-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: .75rem; }
.lp-gallery-item {
  aspect-ratio: 4/3; background: linear-gradient(135deg, #e0e7ff, #c7d2fe);
  border-radius: 10px; display: flex; align-items: center; justify-content: center;
  color: #6366f1; font-size: .8rem; font-weight: 600; cursor: pointer;
  transition: transform .2s; overflow: hidden;
}
.lp-gallery-item:hover { transform: scale(1.02); }
@media (max-width: 640px) { .lp-gallery-grid { grid-template-columns: repeat(2, 1fr); } }`,
  },

  /* ── Testimonials (extra) ─────────────────────────────────────────────────── */
  {
    id: "voices",
    label: "お客様の声",
    icon: "💬",
    description: "星評価付きのレビュー・体験談カード",
    generateHtml: () => `
<section class="lp-voices">
  <div class="lp-voices-inner">
    <h2 class="lp-voices-title">お客様の声</h2>
    <div class="lp-voices-grid">
      <div class="lp-voice-card">
        <div class="lp-voice-star">★★★★★</div>
        <p class="lp-voice-text">「スタッフの方がとても親切で、初めてでも安心して利用できました。また利用したいと思います！」</p>
        <p class="lp-voice-name">— 30代 女性・主婦</p>
      </div>
      <div class="lp-voice-card">
        <div class="lp-voice-star">★★★★★</div>
        <p class="lp-voice-text">「対応が丁寧で、仕上がりにも大満足です。友人にも紹介したいと思います。」</p>
        <p class="lp-voice-name">— 40代 男性・会社員</p>
      </div>
      <div class="lp-voice-card">
        <div class="lp-voice-star">★★★★☆</div>
        <p class="lp-voice-text">「予約から当日まで、スムーズに対応していただきました。料金も明確でわかりやすかったです。」</p>
        <p class="lp-voice-name">— 20代 女性・学生</p>
      </div>
    </div>
    <p class="lp-voices-note">※お客様の声はサンプルです。実際の声に差し替えてください。</p>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-voices { padding: 64px 20px; background: #f9fafb; }
.lp-voices-inner { max-width: 960px; margin: 0 auto; text-align: center; }
.lp-voices-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 2rem; }
.lp-voices-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; text-align: left; }
.lp-voice-card { background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 2px 12px rgba(0,0,0,.06); }
.lp-voice-star { color: #f59e0b; font-size: 1rem; margin-bottom: .75rem; }
.lp-voice-text { font-size: .9rem; color: #374151; line-height: 1.7; margin: 0 0 1rem; }
.lp-voice-name { font-size: .8rem; color: #9ca3af; font-weight: 600; margin: 0; }
.lp-voices-note { margin-top: 2rem; font-size: .75rem; color: #9ca3af; }
@media (max-width: 768px) { .lp-voices-grid { grid-template-columns: 1fr; } }`,
  },

  /* ── Before/After ────────────────────────────────────────────────────────── */
  {
    id: "beforeafter",
    label: "Before / After",
    icon: "🔄",
    description: "施術・サービス前後の比較を並べて表示",
    generateHtml: () => `
<section class="lp-beforeafter">
  <div class="lp-ba-inner">
    <h2 class="lp-ba-title">Before / After</h2>
    <p class="lp-ba-sub">サービスによる変化をご覧ください</p>
    <div class="lp-ba-grid">
      <div class="lp-ba-card lp-ba-before">
        <div class="lp-ba-badge lp-ba-badge-before">Before</div>
        <div class="lp-ba-img"><span>施術前の写真</span></div>
        <p class="lp-ba-desc">施術前の状態。お悩みを詳しく伺いながら丁寧にカウンセリングします。</p>
      </div>
      <div class="lp-ba-card lp-ba-after">
        <div class="lp-ba-badge lp-ba-badge-after">After</div>
        <div class="lp-ba-img"><span>施術後の写真</span></div>
        <p class="lp-ba-desc">施術後の状態。お客様に合わせた最適な施術で、理想の状態へ導きます。</p>
      </div>
    </div>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-beforeafter { padding: 64px 20px; background: #fff; }
.lp-ba-inner { max-width: 820px; margin: 0 auto; text-align: center; }
.lp-ba-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 .5rem; }
.lp-ba-sub { color: #6b7280; font-size: .9rem; margin: 0 0 2.5rem; }
.lp-ba-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; text-align: left; }
.lp-ba-card { border-radius: 14px; overflow: hidden; border: 2px solid #e5e7eb; }
.lp-ba-badge { display: inline-block; padding: .3rem .8rem; border-radius: 4px; font-size: .75rem; font-weight: 700; margin: 1rem 0 0 1rem; }
.lp-ba-badge-before { background: #fee2e2; color: #dc2626; }
.lp-ba-badge-after { background: #d1fae5; color: #059669; }
.lp-ba-img {
  width: 100%; height: 220px; background: linear-gradient(135deg, #f3f4f6, #e5e7eb);
  display: flex; align-items: center; justify-content: center;
  color: #9ca3af; font-size: .85rem; margin-top: .75rem;
}
.lp-ba-desc { padding: 1rem; font-size: .875rem; color: #4b5563; line-height: 1.65; margin: 0; }
@media (max-width: 640px) { .lp-ba-grid { grid-template-columns: 1fr; } }`,
  },

  /* ── LINE CTA ────────────────────────────────────────────────────────────── */
  {
    id: "linecta",
    label: "LINE CTA",
    icon: "💚",
    description: "LINEで問い合わせを促す目立つバナー",
    inputs: [
      { key: "lineUrl", label: "LINE URL", placeholder: "https://line.me/ti/p/XXXXXX", type: "url", required: true },
      { key: "headline", label: "見出しテキスト", placeholder: "LINEで無料相談受付中！", defaultValue: "LINEで無料相談受付中！" },
      { key: "sub", label: "サブテキスト", placeholder: "お気軽にメッセージください", defaultValue: "お気軽にメッセージください" },
    ],
    generateHtml: ({ lineUrl = "#", headline = "LINEで無料相談受付中！", sub = "お気軽にメッセージください" }) => `
<section class="lp-linecta">
  <div class="lp-lc-inner">
    <div class="lp-lc-icon">
      <svg viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="36" height="36" rx="8" fill="#06C755"/><path d="M28 16.3c0-4.7-4.7-8.5-10.5-8.5S7 11.6 7 16.3c0 4.2 3.7 7.7 8.7 8.4.34.07.8.23.92.52.1.27.07.68.04.95l-.15.9c-.05.27-.22 1.06.93.58 1.15-.48 6.2-3.65 8.46-6.25C27.4 19.4 28 17.94 28 16.3z" fill="white"/></svg>
    </div>
    <h2 class="lp-lc-headline">${headline}</h2>
    <p class="lp-lc-sub">${sub}</p>
    <a class="lp-lc-btn" href="${lineUrl}" target="_blank" rel="noopener">
      LINEで相談する（無料）
    </a>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-linecta { padding: 56px 20px; background: #06C755; }
.lp-lc-inner { max-width: 560px; margin: 0 auto; text-align: center; }
.lp-lc-icon { width: 56px; height: 56px; margin: 0 auto 1.25rem; }
.lp-lc-icon svg { width: 100%; height: 100%; }
.lp-lc-headline { font-size: 1.75rem; font-weight: 800; color: #fff; margin: 0 0 .5rem; }
.lp-lc-sub { color: rgba(255,255,255,.85); margin: 0 0 1.75rem; font-size: .95rem; }
.lp-lc-btn {
  display: inline-block; padding: .9rem 2.5rem; background: #fff; color: #06C755;
  border-radius: 50px; font-weight: 800; font-size: 1rem; text-decoration: none;
  box-shadow: 0 4px 20px rgba(0,0,0,.15); transition: transform .2s;
}
.lp-lc-btn:hover { transform: translateY(-2px); }`,
  },

  /* ── Instagram ───────────────────────────────────────────────────────────── */
  {
    id: "instagram",
    label: "Instagram埋め込み",
    icon: "📸",
    description: "Instagram投稿のURLを入力して埋め込み表示",
    inputs: [
      { key: "postUrl", label: "Instagram投稿URL", placeholder: "https://www.instagram.com/p/XXXXXXX/", type: "url", required: true },
      { key: "title", label: "見出し", placeholder: "Instagram", defaultValue: "Instagram" },
    ],
    generateHtml: ({ postUrl = "https://www.instagram.com/", title = "Instagram" }) => `
<section class="lp-instagram">
  <div class="lp-ig-inner">
    <h2 class="lp-ig-title">${title}</h2>
    <p class="lp-ig-lead">最新の投稿はInstagramでチェック！</p>
    <div class="lp-ig-embed">
      <blockquote class="instagram-media"
        data-instgrm-captioned
        data-instgrm-permalink="${postUrl}"
        data-instgrm-version="14"
        style="background:#fff;border:0;border-radius:12px;box-shadow:0 0 0 1px #d1d5db,0 0 0 3px #fff;margin:0 auto;max-width:540px;min-width:326px;padding:0;width:calc(100% - 2px);">
        <a href="${postUrl}" target="_blank" rel="noopener" class="lp-ig-fallback">
          📸 Instagramで見る →
        </a>
      </blockquote>
    </div>
    <script async src="//www.instagram.com/embed.js"></script>
  </div>
</section>`.trim(),
    generateCss: () => `
.lp-instagram { padding: 64px 20px; background: #fafafa; }
.lp-ig-inner { max-width: 620px; margin: 0 auto; text-align: center; }
.lp-ig-title { font-size: 1.75rem; font-weight: 700; margin: 0 0 .5rem; }
.lp-ig-lead { color: #6b7280; font-size: .9rem; margin: 0 0 2rem; }
.lp-ig-embed { display: flex; justify-content: center; }
.lp-ig-fallback {
  display: block; padding: 1.5rem; color: #6366f1; text-decoration: none;
  font-weight: 700; font-size: 1rem;
}`,
  },

  /* ── Fixed CTA Bar ───────────────────────────────────────────────────────── */
  {
    id: "fixedcta",
    label: "固定CTAバー",
    icon: "📌",
    description: "スマホ画面下部に固定表示するCTAボタン群",
    insertAtEnd: true,
    inputs: [
      { key: "lineUrl", label: "LINE URL", placeholder: "https://line.me/ti/p/XXXXXX", type: "url" },
      { key: "tel", label: "電話番号", placeholder: "090-0000-0000", type: "tel" },
      { key: "formUrl", label: "お問い合わせURL", placeholder: "#contact", defaultValue: "#contact" },
    ],
    generateHtml: ({ lineUrl = "#", tel = "000-0000-0000", formUrl = "#contact" }) => `
<div class="lp-fixedcta">
  <a class="lp-fcta-btn lp-fcta-line" href="${lineUrl}" target="_blank" rel="noopener">
    <svg class="lp-fcta-icon" viewBox="0 0 24 24" fill="white"><path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.627.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.064-.022.133-.031.199-.031.211 0 .391.09.51.25l2.444 3.317V8.108c0-.345.282-.63.631-.63.345 0 .627.285.627.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164.96c-.045.301-.24 1.186.955.645 1.197-.539 6.433-3.778 8.752-6.474C23.239 14.282 24 12.396 24 10.314"/></svg>
    LINE相談
  </a>
  <a class="lp-fcta-btn lp-fcta-tel" href="tel:${tel}">
    <svg class="lp-fcta-icon" viewBox="0 0 24 24" fill="white"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>
    電話する
  </a>
  <a class="lp-fcta-btn lp-fcta-form" href="${formUrl}">
    <svg class="lp-fcta-icon" viewBox="0 0 24 24" fill="white"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
    メール
  </a>
</div>`.trim(),
    generateCss: () => `
.lp-fixedcta {
  position: fixed; bottom: 0; left: 0; right: 0; display: flex; z-index: 9999;
  background: #fff; border-top: 1px solid #e5e7eb; box-shadow: 0 -4px 16px rgba(0,0,0,.1);
}
.lp-fcta-btn {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding: 10px 4px; text-decoration: none; font-weight: 700; font-size: .7rem;
  color: #fff; transition: opacity .2s;
}
.lp-fcta-btn:hover { opacity: .85; }
.lp-fcta-icon { width: 20px; height: 20px; flex-shrink: 0; }
.lp-fcta-line { background: #06C755; }
.lp-fcta-tel { background: #3b82f6; }
.lp-fcta-form { background: #6366f1; }
body { padding-bottom: 60px; }`,
  },
];
