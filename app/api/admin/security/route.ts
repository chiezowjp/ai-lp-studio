/**
 * GET /api/admin/security — セキュリティ監視データ（管理者専用）
 *
 * レスポンス:
 *   {
 *     securityEvents: SecurityEvent[],    // 直近100件
 *     auditLogs:      AuditLog[],         // 直近100件
 *     rateLimitHits:  RateLimitSummary[], // 直近24h の上位 IP/ユーザー
 *     formSpam:       FormSpamSummary[],  // 直近24h のスパム IP
 *     exportAbuse:    ExportAbuse[],      // 直近24h の多発エクスポートユーザー
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

function since(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString();
}

export async function GET(req: NextRequest) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  // ── 管理者確認 ──────────────────────────────────────────────────────────────
  const { data: myProfile } = await admin
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!myProfile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // ── 並列クエリ ──────────────────────────────────────────────────────────────
  const [
    securityEventsRes,
    auditLogsRes,
    rateLimitEventsRes,
    exportLogsRes,
    formSpamEventsRes,
  ] = await Promise.all([
    // 直近48hのセキュリティイベント（最大200件）
    admin
      .from("security_events")
      .select("id, event_type, user_id, ip_address, severity, metadata, created_at")
      .gte("created_at", since(48))
      .order("created_at", { ascending: false })
      .limit(200),

    // 直近24hの監査ログ（最大100件）
    admin
      .from("audit_logs")
      .select("id, user_id, action, target_type, target_id, metadata, ip_address, created_at")
      .gte("created_at", since(24))
      .order("created_at", { ascending: false })
      .limit(100),

    // 直近24hのレートリミット超過イベント
    admin
      .from("security_events")
      .select("user_id, ip_address, metadata, created_at")
      .eq("event_type", "rate_limit_exceeded")
      .gte("created_at", since(24))
      .order("created_at", { ascending: false })
      .limit(500),

    // 直近24hのエクスポート監査ログ
    admin
      .from("audit_logs")
      .select("user_id, action, metadata, created_at")
      .eq("action", "lead_export")
      .gte("created_at", since(24))
      .order("created_at", { ascending: false })
      .limit(200),

    // 直近24hのフォームスパムイベント
    admin
      .from("security_events")
      .select("user_id, ip_address, metadata, created_at")
      .eq("event_type", "form_spam")
      .gte("created_at", since(24))
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  // ── レートリミット上位集計 ────────────────────────────────────────────────
  const rlEvents = rateLimitEventsRes.data ?? [];
  const rlByIp: Record<string, number> = {};
  const rlByUser: Record<string, number> = {};
  for (const ev of rlEvents) {
    if (ev.ip_address) rlByIp[ev.ip_address] = (rlByIp[ev.ip_address] ?? 0) + 1;
    if (ev.user_id)    rlByUser[ev.user_id]   = (rlByUser[ev.user_id]   ?? 0) + 1;
  }
  const rateLimitHits = [
    ...Object.entries(rlByIp).map(([key, count]) => ({ type: "ip",   key, count })),
    ...Object.entries(rlByUser).map(([key, count]) => ({ type: "user", key, count })),
  ]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // ── エクスポート多発ユーザー集計 ──────────────────────────────────────────
  const exportEvents = exportLogsRes.data ?? [];
  const exportByUser: Record<string, number> = {};
  for (const ev of exportEvents) {
    if (ev.user_id) exportByUser[ev.user_id] = (exportByUser[ev.user_id] ?? 0) + 1;
  }
  const exportAbuse = Object.entries(exportByUser)
    .map(([userId, count]) => ({ userId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // ── フォームスパム IP 集計 ────────────────────────────────────────────────
  const spamEvents = formSpamEventsRes.data ?? [];
  const spamByIp: Record<string, number> = {};
  for (const ev of spamEvents) {
    if (ev.ip_address) spamByIp[ev.ip_address] = (spamByIp[ev.ip_address] ?? 0) + 1;
  }
  const formSpam = Object.entries(spamByIp)
    .map(([ip, count]) => ({ ip, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return NextResponse.json({
    securityEvents: securityEventsRes.data ?? [],
    auditLogs:      auditLogsRes.data ?? [],
    rateLimitHits,
    formSpam,
    exportAbuse,
  });
}
