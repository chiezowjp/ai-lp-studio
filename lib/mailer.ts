/**
 * lib/mailer.ts — メール送信ユーティリティ
 *
 * 送信方法: Resend API（fetch ベース — HTTPなのでRailwayのSMTPブロックに影響されない）
 *
 * 環境変数:
 *   RESEND_API_KEY  — Resend の API キー（必須）
 *   FROM_EMAIL      — 送信元アドレス（独自ドメイン認証済みの場合に設定）
 *                     未設定時は onboarding@resend.dev を使用
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** 送信者の表示名。省略時は FROM_EMAIL の設定値をそのまま使用 */
  fromName?: string;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resend API でメールを送信する。
 * RESEND_API_KEY が未設定の場合は警告をログに出力してスキップする。
 */
export async function sendMail(options: MailOptions): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[mailer] RESEND_API_KEY not set. Skipping email.");
    return;
  }

  // FROM_EMAIL は "Name <addr@example.com>" 形式または "addr@example.com" 形式
  // fromName が指定された場合はアドレス部分だけ取り出して表示名を差し替える
  const fromEnv = process.env.FROM_EMAIL ?? "onboarding@resend.dev";
  let from = fromEnv;
  if (options.fromName) {
    // "Name <addr>" → addr 抽出、または fromEnv をそのままアドレスとして使用
    const addrMatch = fromEnv.match(/<([^>]+)>/);
    const addr = addrMatch ? addrMatch[1] : fromEnv;
    from = `${options.fromName} <${addr}>`;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [options.to],
      subject: options.subject,
      html: options.html,
      text: options.text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

// ─── テンプレート ─────────────────────────────────────────────────────────────

export function buildLeadNotificationHtml(params: {
  lpTitle: string;
  lpUrl: string;
  formName: string;
  submittedAt: string;
  fields: { label: string; value: string }[];
}): string {
  const rows = params.fields
    .map(
      (f) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#555;font-weight:bold;width:30%;border-bottom:1px solid #f0f0f0;">${escapeHtml(f.label)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${escapeHtml(f.value)}</td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>新しいお問い合わせ</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#00AFCC;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:12px;font-weight:bold;letter-spacing:.05em;">AI LP STUDIO</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;">📬 新しいお問い合わせ</h1>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:14px;color:#555;">
        <strong>${escapeHtml(params.lpTitle)}</strong> に新しいお問い合わせが届きました。
      </p>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
        ${rows}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa;">
        送信日時: ${params.submittedAt}
      </p>
    </div>
    <div style="padding:16px 32px;background:#f9f9f9;border-top:1px solid #eee;">
      <a href="${params.lpUrl}" style="color:#00AFCC;font-size:13px;text-decoration:none;font-weight:bold;">
        公開ページを開く →
      </a>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 問い合わせ者への自動返信メール HTML を生成する。
 */
export function buildAutoReplyHtml(params: {
  lpTitle: string;
  submittedAt: string;
  fields: { label: string; value: string }[];
  footer: string;
}): string {
  const rows = params.fields
    .map(
      (f) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;color:#555;font-weight:bold;width:30%;border-bottom:1px solid #f0f0f0;">${escapeHtml(f.label)}</td>
        <td style="padding:8px 12px;font-size:13px;color:#333;border-bottom:1px solid #f0f0f0;">${escapeHtml(f.value)}</td>
      </tr>`
    )
    .join("");

  const footerHtml = params.footer
    ? `<p style="margin:24px 0 0;font-size:13px;color:#444;white-space:pre-line;">${escapeHtml(params.footer)}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><title>お問い合わせ受付確認</title></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
    <div style="background:#00AFCC;padding:24px 32px;">
      <p style="margin:0;color:#fff;font-size:12px;font-weight:bold;letter-spacing:.05em;">${escapeHtml(params.lpTitle)}</p>
      <h1 style="margin:8px 0 0;color:#fff;font-size:20px;">✅ お問い合わせを受け付けました</h1>
    </div>
    <div style="padding:24px 32px;">
      <p style="margin:0 0 16px;font-size:14px;color:#555;">
        この度はお問い合わせいただき、ありがとうございます。<br>
        以下の内容で受け付けました。担当者よりご連絡いたします。
      </p>
      <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden;border:1px solid #f0f0f0;">
        ${rows}
      </table>
      <p style="margin:16px 0 0;font-size:12px;color:#aaa;">
        送信日時: ${params.submittedAt}
      </p>
      ${footerHtml}
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
