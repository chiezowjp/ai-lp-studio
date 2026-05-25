/**
 * GET /api/leads — リード一覧取得（認証済みユーザーのリードのみ）
 *
 * Query params:
 *   project_id — 絞り込み（省略時: 全プロジェクト）
 *   status     — new | contacted | archived（省略時: 全ステータス）
 *   q          — ペイロード全文検索（簡易）
 *   page       — ページ番号（1始まり、省略時: 1）
 *   per_page   — 1ページあたり件数（省略時: 50、最大200）
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("project_id");
  const status    = searchParams.get("status");
  const q         = searchParams.get("q");
  const page      = Math.max(1, Number(searchParams.get("page") ?? 1));
  const perPage   = Math.min(200, Math.max(1, Number(searchParams.get("per_page") ?? 50)));

  const admin = createAdminClient();

  let query = admin
    .from("leads")
    .select(
      "id, project_id, project_slug, form_name, payload, submitted_at, status, ip_address, referrer",
      { count: "exact" }
    )
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .range((page - 1) * perPage, page * perPage - 1);

  if (projectId) query = query.eq("project_id", projectId);
  if (status)    query = query.eq("status", status);
  if (q) {
    // payload JSONB の全文検索（簡易: テキストキャスト LIKE 検索）
    query = query.ilike("payload::text", `%${q}%`);
  }

  const { data, count, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    leads: data ?? [],
    total:    count ?? 0,
    page,
    per_page: perPage,
    pages:    Math.ceil((count ?? 0) / perPage),
  });
}
