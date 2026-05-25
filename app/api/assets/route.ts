/**
 * GET  /api/assets — アセット一覧
 * POST /api/assets — アセットアップロード（multipart/form-data）
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { PLAN_LIMITS } from "@/lib/plans";
import type { PlanType } from "@/lib/plans";
import { logAudit } from "@/lib/audit-logger";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME  = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"];
const BUCKET        = "lp-assets";

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("project_id");
  const usageType = searchParams.get("usage_type");

  let query = admin
    .from("assets")
    .select("id, url, storage_path, file_name, file_size, mime_type, width, height, usage_type, project_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  if (projectId) query = query.eq("project_id", projectId);
  if (usageType)  query = query.eq("usage_type", usageType);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // ── プラン確認（Trial: 10件まで） ────────────────────────────────────────
  const { data: profile } = await admin
    .from("profiles")
    .select("plan_type, billing_status")
    .eq("id", user.id)
    .maybeSingle();

  const rawPlan = (profile?.plan_type ?? "trial") as PlanType;
  const planType: PlanType =
    profile?.billing_status === "expired" && rawPlan === "pro" ? "expired" : rawPlan;
  const maxAssets = PLAN_LIMITS[planType].maxAssets;

  if (maxAssets === 0 && planType === "expired") {
    return NextResponse.json(
      { error: "プランが期限切れです。", code: "PLAN_EXPIRED" },
      { status: 403 },
    );
  }

  // Trial は件数制限チェック
  if (maxAssets > 0) {
    const { count } = await admin
      .from("assets")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= maxAssets) {
      return NextResponse.json(
        { error: `アセットの上限（${maxAssets}件）に達しました。Pro プランにアップグレードしてください。`, code: "ASSET_LIMIT" },
        { status: 403 },
      );
    }
  }

  // ── FormData パース ───────────────────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "FormData のパースに失敗しました" }, { status: 400 });
  }

  const file       = formData.get("file") as File | null;
  const projectId  = formData.get("project_id") as string | null;
  const usageType  = (formData.get("usage_type") as string | null) ?? "general";

  if (!file) {
    return NextResponse.json({ error: "file は必須です" }, { status: 400 });
  }

  // ── ファイルバリデーション ────────────────────────────────────────────────
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: `対応していないファイル形式です（対応: ${ALLOWED_MIME.join(", ")}）` },
      { status: 400 },
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `ファイルサイズが大きすぎます（上限 10 MB）` },
      { status: 413 },
    );
  }

  // ── Supabase Storage にアップロード ──────────────────────────────────────
  const ext        = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
  const folder     = usageType === "og_image" ? "og" : usageType === "favicon" ? "favicon" : "general";
  const timestamp  = Date.now();
  const storagePath = `${user.id}/${folder}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const arrayBuffer = await file.arrayBuffer();
  const uint8Array  = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(storagePath, uint8Array, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("[assets] storage upload error:", uploadError.message);
    return NextResponse.json(
      { error: `アップロードに失敗しました: ${uploadError.message}` },
      { status: 500 },
    );
  }

  // ── 公開 URL 取得 ─────────────────────────────────────────────────────────
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // ── DB にメタデータ保存 ───────────────────────────────────────────────────
  const validUsageTypes = ["general", "og_image", "favicon", "lp_image"];
  const { data: asset, error: dbError } = await admin
    .from("assets")
    .insert({
      user_id:      user.id,
      project_id:   projectId ?? null,
      url:          publicUrl,
      storage_path: storagePath,
      file_name:    file.name,
      file_size:    file.size,
      mime_type:    file.type,
      usage_type:   validUsageTypes.includes(usageType) ? usageType : "general",
    })
    .select("id, url, file_name, file_size, mime_type, usage_type, created_at")
    .single();

  if (dbError) {
    console.error("[assets] db insert error:", dbError.message);
    // Storage からも削除（ロールバック）
    await admin.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  logAudit({
    userId: user.id,
    action: "project_update",
    targetType: "asset",
    targetId: asset.id,
    metadata: { fileName: file.name, fileSize: file.size, usageType },
    req,
  });

  return NextResponse.json(asset, { status: 201 });
}
