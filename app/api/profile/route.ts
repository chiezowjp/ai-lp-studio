import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

// ─── GET /api/profile  ── プロファイル取得（存在しなければ trial で自動作成）──

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // 既存プロファイルを取得
  const { data: existing, error: fetchErr } = await admin
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });

  if (existing) return NextResponse.json(existing);

  // 初回ログイン: トライアルプロファイルを自動作成（3日間）
  const trialEndsAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  const { data: created, error: insertErr } = await admin
    .from("profiles")
    .insert({
      id: user.id,
      plan_type: "trial",
      trial_ends_at: trialEndsAt,
      is_admin: false,
    })
    .select()
    .single();

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  // 管理者に新規登録通知メールを送信（失敗しても登録自体は成功扱い）
  try {
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from: process.env.FROM_EMAIL ?? "noreply@ailpstudio.com",
          to: "chiezowjp@gmail.com",
          subject: "【AI LP STUDIO】新規トライアル登録がありました",
          html: `
            <p>新規ユーザーがトライアル登録しました。</p>
            <ul>
              <li>メールアドレス: ${user.email ?? "不明"}</li>
              <li>登録日時: ${new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</li>
              <li>トライアル終了: ${new Date(trialEndsAt).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}</li>
            </ul>
            <p><a href="https://bihvddyytggfdlgzcjtm.supabase.co/dashboard/project/bihvddyytggfdlgzcjtm/editor">Supabaseで確認する</a></p>
          `,
        }),
      });
    }
  } catch {
    // 通知失敗は無視
  }

  return NextResponse.json(created);
}

// ─── PATCH /api/profile  ── プラン更新（管理者専用）──────────────────────────

export async function PATCH(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // 管理者確認
  const { data: profile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { target_user_id, plan_type } = body as { target_user_id: string; plan_type: string };

  if (!target_user_id || !["trial", "pro", "expired"].includes(plan_type)) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const trialEndsAt = plan_type === "trial"
    ? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await admin
    .from("profiles")
    .upsert({
      id: target_user_id,
      plan_type,
      trial_ends_at: trialEndsAt,
      is_admin: false,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
