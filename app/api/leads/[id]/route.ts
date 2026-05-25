/**
 * PATCH /api/leads/[id] — リードのステータス更新
 * DELETE /api/leads/[id] — リード削除
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

type RouteCtx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // オーナー確認
  const { data: existing } = await admin
    .from("leads")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json()) as { status?: string };
  const VALID_STATUSES = ["new", "contacted", "archived"];

  if (body.status && !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("leads")
    .update({ status: body.status })
    .eq("id", id)
    .select("id, status")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // オーナー確認
  const { data: existing } = await admin
    .from("leads")
    .select("id, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin.from("leads").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
