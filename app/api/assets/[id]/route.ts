/**
 * DELETE /api/assets/[id] — アセット削除
 *
 * Storage ファイルと DB レコードの両方を削除する。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

type RouteCtx = { params: Promise<{ id: string }> };

const BUCKET = "lp-assets";

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // 所有者確認 + storage_path 取得
  const { data: asset } = await admin
    .from("assets")
    .select("id, user_id, storage_path")
    .eq("id", id)
    .maybeSingle();

  if (!asset || asset.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Storage からファイル削除
  const { error: storageErr } = await admin.storage
    .from(BUCKET)
    .remove([asset.storage_path]);

  if (storageErr) {
    console.error("[assets/delete] storage remove error:", storageErr.message);
    // Storage 削除失敗でも DB からは削除を試みる
  }

  // DB レコード削除
  const { error: dbErr } = await admin.from("assets").delete().eq("id", id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
