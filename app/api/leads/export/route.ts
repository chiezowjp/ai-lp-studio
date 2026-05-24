/**
 * GET /api/leads/export — リード CSV エクスポート（UTF-8 BOM 付き）
 *
 * Query params:
 *   project_id — 絞り込み（省略時: 全プロジェクト）
 *   status     — ステータスフィルタ
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { requirePlanGuard } from "@/lib/plan-guard";
import { logAudit } from "@/lib/audit-logger";

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(req: NextRequest) {
  // ── サーバーサイド プラン・課金ガード（Pro 限定） ──
  const guard = await requirePlanGuard(req, { requirePro: true });
  if (guard instanceof NextResponse) return guard;
  const { user } = guard;

  const { searchParams } = req.nextUrl;
  const projectId = searchParams.get("project_id");
  const status    = searchParams.get("status");

  const admin = createAdminClient();

  let query = admin
    .from("leads")
    .select("id, project_id, project_slug, form_name, payload, submitted_at, status, ip_address, referrer")
    .eq("user_id", user.id)
    .order("submitted_at", { ascending: false })
    .limit(10000);

  if (projectId) query = query.eq("project_id", projectId);
  if (status)    query = query.eq("status", status);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const leads = data ?? [];

  // ヘッダー行: 全フィールドのキーを収集
  const allPayloadKeys = new Set<string>();
  for (const lead of leads) {
    const payload = lead.payload as Record<string, unknown>;
    for (const key of Object.keys(payload)) {
      allPayloadKeys.add(key);
    }
  }
  const payloadKeys = [...allPayloadKeys];

  const headers = [
    "ID",
    "プロジェクトスラグ",
    "フォーム名",
    "送信日時",
    "ステータス",
    ...payloadKeys,
    "IPアドレス",
    "リファラー",
  ];

  const rows: string[] = [headers.map(escapeCsv).join(",")];

  for (const lead of leads) {
    const payload = lead.payload as Record<string, unknown>;
    const row = [
      lead.id,
      lead.project_slug ?? "",
      lead.form_name ?? "",
      lead.submitted_at
        ? new Date(lead.submitted_at).toLocaleString("ja-JP")
        : "",
      lead.status ?? "",
      ...payloadKeys.map((k) => String(payload[k] ?? "")),
      lead.ip_address ?? "",
      lead.referrer ?? "",
    ];
    rows.push(row.map(escapeCsv).join(","));
  }

  // 監査ログ
  logAudit({
    userId: user.id,
    action: "lead_export",
    metadata: { count: leads.length, projectId, status },
    req,
  });

  // UTF-8 BOM 付き
  const bom = "﻿";
  const csv = bom + rows.join("\r\n");

  const filename = `leads_${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type":        "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
