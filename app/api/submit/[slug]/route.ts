/**
 * POST /api/submit/[slug]
 * 公開LP のフォーム送信エンドポイント。
 * 認証不要（公開エンドポイント）。
 *
 * スパム対策:
 *   - Honeypot フィールド（_hp）
 *   - IP ベースレート制限（1 時間に 5 回）
 *   - 送信間隔制限（同一 IP から 10 秒以内の連続送信をブロック）
 *
 * Pro チェック:
 *   - Trial / Expired プランのプロジェクトへの本番送信は拒否
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import type { FormConfig, FormField, WebhookPayload } from "@/lib/form-schema";
import { sendMail, buildLeadNotificationHtml, buildAutoReplyHtml } from "@/lib/mailer";
import { appendToGoogleSheets, extractSpreadsheetId } from "@/lib/google-sheets";

type RouteCtx = { params: Promise<{ slug: string }> };

// ─── Rate limit チェック ──────────────────────────────────────────────────────

async function checkRateLimit(
  admin: ReturnType<typeof createAdminClient>,
  projectId: string,
  ip: string,
): Promise<{ ok: boolean; reason?: string }> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const tenSecondsAgo = new Date(Date.now() - 10 * 1000).toISOString();

  // 1 時間以内の同一 IP からの送信数
  const { count: hourCount } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("ip_address", ip)
    .gte("submitted_at", oneHourAgo);

  if ((hourCount ?? 0) >= 5) {
    return { ok: false, reason: "送信回数の上限に達しました。しばらく時間をおいてから再度お試しください。" };
  }

  // 10 秒以内の連続送信
  const { count: recentCount } = await admin
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .eq("ip_address", ip)
    .gte("submitted_at", tenSecondsAgo);

  if ((recentCount ?? 0) >= 1) {
    return { ok: false, reason: "送信が完了しています。しばらくお待ちください。" };
  }

  return { ok: true };
}

// ─── フォームデータ検証 ───────────────────────────────────────────────────────

function validateFormData(
  body: Record<string, unknown>,
  fields: FormField[],
): { ok: boolean; errors: string[]; payload: Record<string, unknown> } {
  const errors: string[] = [];
  const payload: Record<string, unknown> = {};

  for (const field of fields) {
    const rawValue = body[field.name];
    const value = Array.isArray(rawValue)
      ? (rawValue as string[]).map((v) => String(v)).join(", ")
      : rawValue !== undefined && rawValue !== null
        ? String(rawValue).trim()
        : "";

    if (field.required && !value) {
      errors.push(`「${field.label}」は必須項目です。`);
    }

    // 簡易バリデーション
    if (field.type === "email" && value) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        errors.push(`「${field.label}」の形式が正しくありません。`);
      }
    }
    if (field.type === "tel" && value) {
      if (!/^[\d\-+() ]{7,20}$/.test(value)) {
        errors.push(`「${field.label}」の形式が正しくありません。`);
      }
    }

    // 最大文字数チェック
    if (typeof value === "string" && value.length > 5000) {
      errors.push(`「${field.label}」が長すぎます。`);
    }

    payload[field.name] = value;
  }

  return { ok: errors.length === 0, errors, payload };
}

// ─── Webhook 送信 ─────────────────────────────────────────────────────────────

async function sendWebhook(webhookUrl: string, secret: string, payload: WebhookPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "AI-LP-Studio/1.0",
  };
  if (secret) {
    headers["X-Webhook-Secret"] = secret;
  }

  const res = await fetch(webhookUrl, { method: "POST", headers, body });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[webhook] Failed ${res.status}: ${text.slice(0, 200)}`);
  }
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest, ctx: RouteCtx) {
  const { slug } = await ctx.params;
  const admin = createAdminClient();

  // ── プロジェクト取得 ──
  const { data: project } = await admin
    .from("projects")
    .select("id, title, user_id, slug, is_published, form_config")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const formConfig = project.form_config as FormConfig | null;

  if (!formConfig?.enabled) {
    return NextResponse.json({ error: "Form is not enabled" }, { status: 400 });
  }

  // ── オーナーのプラン確認 ──
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_type")
    .eq("id", project.user_id)
    .maybeSingle();

  const planType = (profile?.plan_type as string) ?? "trial";
  if (planType !== "pro") {
    // Trial / Expired の場合は本番送信不可
    return NextResponse.json(
      {
        error: "フォーム受信は Pro プランでご利用いただけます。",
        code: "PLAN_LIMIT",
      },
      { status: 403 }
    );
  }

  // ── IP・User-Agent 取得 ──
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "";
  const referrer  = req.headers.get("referer") ?? null;

  // ── レート制限 ──
  const rateCheck = await checkRateLimit(admin, project.id as string, ip);
  if (!rateCheck.ok) {
    return NextResponse.json({ error: rateCheck.reason }, { status: 429 });
  }

  // ── ボディ解析 ──
  let body: Record<string, unknown>;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = (await req.json()) as Record<string, unknown>;
    } else {
      const formData = await req.formData();
      body = Object.fromEntries(
        [...formData.keys()].map((k) => {
          const vals = formData.getAll(k);
          return [k, vals.length === 1 ? vals[0] : vals];
        })
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // ── Honeypot チェック ──
  if (body._hp) {
    // ボット判定: 成功レスポンスを返してボットを混乱させる
    return NextResponse.json({ success: true });
  }

  // ── フォームデータ検証 ──
  const { ok, errors, payload } = validateFormData(body, formConfig.fields);
  if (!ok) {
    return NextResponse.json({ error: errors[0], errors }, { status: 422 });
  }

  // ── leads テーブルへ保存 ──
  const { data: lead, error: insertError } = await admin
    .from("leads")
    .insert({
      project_id:   project.id,
      project_slug: project.slug,
      user_id:      project.user_id,
      form_name:    "contact",
      payload,
      ip_address:   ip,
      user_agent:   userAgent,
      referrer,
      status:       "new",
    })
    .select("id, submitted_at")
    .single();

  if (insertError || !lead) {
    console.error("[submit] Insert error:", insertError);
    return NextResponse.json({ error: "保存に失敗しました。" }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const lpUrl  = `${appUrl}/p/${slug}`;

  // ── 並列で後処理（失敗してもレスポンスには影響させない） ──
  const afterTasks: Promise<void>[] = [];

  // メール通知
  if (formConfig.emailNotification.enabled) {
    afterTasks.push(
      (async () => {
        try {
          // 送信先: 設定値 → オーナーのメールアドレス
          let toEmail = formConfig.emailNotification.toEmail;
          if (!toEmail) {
            const { data: ownerAuth } = await admin.auth.admin.getUserById(project.user_id as string);
            toEmail = ownerAuth?.user?.email ?? null;
          }
          if (!toEmail) return;

          const fieldLabels = formConfig.fields.map((f) => ({
            label: f.label,
            value: String(payload[f.name] ?? ""),
          }));

          const html = buildLeadNotificationHtml({
            lpTitle:     project.title as string,
            lpUrl,
            formName:    "contact",
            submittedAt: new Date((lead as { submitted_at: string }).submitted_at).toLocaleString("ja-JP"),
            fields:      fieldLabels,
          });

          await sendMail({
            to:       toEmail,
            fromName: project.title as string,
            subject:  `【新着】${project.title as string} にお問い合わせが届きました`,
            html,
            text:     fieldLabels.map((f) => `${f.label}: ${f.value}`).join("\n"),
          });
        } catch (e) {
          console.error("[submit] Mail error:", e);
        }
      })()
    );
  }

  // 自動返信メール（問い合わせ者へ）
  if (formConfig.autoReply?.enabled) {
    afterTasks.push(
      (async () => {
        try {
          // email フィールドを探す
          const emailField = formConfig.fields.find((f) => f.type === "email");
          const replyTo = emailField ? String(payload[emailField.name] ?? "") : "";
          if (!replyTo || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyTo)) return;

          const fieldLabels = formConfig.fields.map((f) => ({
            label: f.label,
            value: String(payload[f.name] ?? ""),
          }));

          const autoReplyHtml = buildAutoReplyHtml({
            lpTitle:     project.title as string,
            submittedAt: new Date((lead as { submitted_at: string }).submitted_at).toLocaleString("ja-JP"),
            fields:      fieldLabels,
            footer:      formConfig.autoReply.footer ?? "",
          });

          const subject = formConfig.autoReply.subject?.trim()
            || `【${project.title as string}】お問い合わせを受け付けました`;

          await sendMail({
            to:       replyTo,
            fromName: project.title as string,
            subject,
            html:     autoReplyHtml,
            text:     `お問い合わせありがとうございます。以下の内容で受け付けました。\n\n${fieldLabels.map((f) => `${f.label}: ${f.value}`).join("\n")}`,
          });
        } catch (e) {
          console.error("[submit] Auto-reply error:", e);
        }
      })()
    );
  }

  // Google Sheets
  if (formConfig.googleSheets.enabled && formConfig.googleSheets.spreadsheetId) {
    afterTasks.push(
      (async () => {
        try {
          const row = [
            new Date((lead as { submitted_at: string }).submitted_at).toLocaleString("ja-JP"),
            project.title as string,
            ...formConfig.fields.map((f) => String(payload[f.name] ?? "")),
            referrer ?? "",
          ];
          await appendToGoogleSheets({
            spreadsheetId: extractSpreadsheetId(formConfig.googleSheets.spreadsheetId),
            sheetName:     formConfig.googleSheets.sheetName || "Sheet1",
            row,
          });
        } catch (e) {
          console.error("[submit] Google Sheets error:", e);
        }
      })()
    );
  }

  // Webhook
  if (formConfig.webhook.enabled && formConfig.webhook.url) {
    afterTasks.push(
      (async () => {
        try {
          const webhookPayload: WebhookPayload = {
            event: "form_submit",
            project: {
              id:    project.id as string,
              slug:  project.slug as string | null,
              title: project.title as string,
            },
            lead: {
              id:           (lead as { id: string }).id,
              form_name:    "contact",
              submitted_at: (lead as { submitted_at: string }).submitted_at,
              referrer,
            },
            data: payload,
          };
          await sendWebhook(
            formConfig.webhook.url,
            formConfig.webhook.secretToken,
            webhookPayload,
          );
        } catch (e) {
          console.error("[submit] Webhook error:", e);
        }
      })()
    );
  }

  // 非同期で後処理を実行（レスポンスをブロックしない）
  Promise.allSettled(afterTasks).catch(() => {});

  return NextResponse.json({
    success: true,
    message: formConfig.successMessage,
    redirectUrl: formConfig.redirectUrl ?? null,
  });
}
