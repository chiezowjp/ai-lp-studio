import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

// レート制限（同一 IP から60秒以内に5件まで）
const rateLimitMap = new Map<string, { count: number; reset: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.reset) {
    rateLimitMap.set(ip, { count: 1, reset: now + 60_000 });
    return true;
  }
  if (entry.count >= 5) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  // IP 取得
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait a moment." },
      { status: 429 }
    );
  }

  // フォームデータ取得
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid form data" }, { status: 400 });
  }

  const to      = (formData.get("_to")     as string | null)?.trim() ?? "";
  const name    = (formData.get("name")    as string | null)?.trim() ?? "";
  const email   = (formData.get("email")   as string | null)?.trim() ?? "";
  const phone   = (formData.get("phone")   as string | null)?.trim() ?? "";
  const message = (formData.get("message") as string | null)?.trim() ?? "";

  // バリデーション
  if (!to || !name || !email || !message) {
    return NextResponse.json({ ok: false, error: "必須項目が不足しています" }, { status: 400 });
  }
  // メールアドレス形式チェック
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(to) || !emailRe.test(email)) {
    return NextResponse.json({ ok: false, error: "メールアドレスの形式が正しくありません" }, { status: 400 });
  }

  // SMTP 設定確認
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (!smtpHost || !smtpUser || !smtpPass) {
    console.error("[contact] SMTP environment variables are not configured.");
    return NextResponse.json(
      { ok: false, error: "メール送信の設定が完了していません（SMTP未設定）" },
      { status: 500 }
    );
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: Number(process.env.SMTP_PORT ?? "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: smtpUser, pass: smtpPass },
  });

  const fromAddress = process.env.SMTP_FROM ?? smtpUser;

  const textBody = [
    `【LP お問い合わせフォームより】`,
    ``,
    `お名前　：${name}`,
    `メール　：${email}`,
    `電話番号：${phone || "（未入力）"}`,
    ``,
    `─── お問い合わせ内容 ───────────────────`,
    message,
    `────────────────────────────────────────`,
    ``,
    `※このメールは LP Studio のお問い合わせフォームから自動送信されました。`,
    `※返信する場合は送信者のメールアドレス（${email}）宛にお送りください。`,
  ].join("\n");

  const htmlBody = `
<div style="font-family:'Noto Sans JP',sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827">
  <h2 style="font-size:18px;border-bottom:2px solid #00AFCC;padding-bottom:8px;color:#00AFCC">
    LP お問い合わせフォームより
  </h2>
  <table style="width:100%;border-collapse:collapse;margin-top:16px;font-size:14px">
    <tr><th style="text-align:left;padding:8px 12px;background:#f3f4f6;width:120px;border:1px solid #e5e7eb">お名前</th>
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${name}</td></tr>
    <tr><th style="text-align:left;padding:8px 12px;background:#f3f4f6;border:1px solid #e5e7eb">メール</th>
        <td style="padding:8px 12px;border:1px solid #e5e7eb"><a href="mailto:${email}">${email}</a></td></tr>
    <tr><th style="text-align:left;padding:8px 12px;background:#f3f4f6;border:1px solid #e5e7eb">電話番号</th>
        <td style="padding:8px 12px;border:1px solid #e5e7eb">${phone || "（未入力）"}</td></tr>
  </table>
  <div style="margin-top:20px">
    <p style="font-weight:bold;font-size:14px;margin:0 0 8px">お問い合わせ内容</p>
    <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;font-size:14px;line-height:1.8;white-space:pre-wrap">${message.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
  </div>
  <p style="margin-top:24px;font-size:12px;color:#9ca3af">
    このメールは LP Studio のお問い合わせフォームから自動送信されました。<br>
    返信先：<a href="mailto:${email}">${email}</a>
  </p>
</div>`;

  try {
    await transporter.sendMail({
      from: `"LP お問い合わせフォーム" <${fromAddress}>`,
      to,
      replyTo: email,
      subject: `【お問い合わせ】${name} 様より`,
      text: textBody,
      html: htmlBody,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[contact] Failed to send email:", err);
    return NextResponse.json(
      { ok: false, error: "メール送信に失敗しました。設定を確認してください。" },
      { status: 500 }
    );
  }
}
