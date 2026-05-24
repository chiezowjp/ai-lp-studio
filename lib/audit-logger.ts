/**
 * lib/audit-logger.ts — 監査ログ・セキュリティイベント記録ユーティリティ
 *
 * すべての書き込みは Service Role Key を持つ管理クライアント経由。
 * fire-and-forget（await 不要）で使用可能。エラーは console.error のみ。
 *
 * ─── 使い方 ────────────────────────────────────────────────────────────────
 *
 *   import { logAudit, logSecurityEvent } from "@/lib/audit-logger";
 *
 *   // fire-and-forget（await 不要）
 *   logAudit({
 *     userId: user.id,
 *     action: "publish",
 *     targetType: "project",
 *     targetId: projectId,
 *     metadata: { slug },
 *     req,
 *   });
 *
 *   // セキュリティイベント
 *   logSecurityEvent({
 *     eventType: "rate_limit_exceeded",
 *     userId: user.id,
 *     ip: "1.2.3.4",
 *     severity: "medium",
 *     metadata: { action: "generate", count: 3, limit: 3 },
 *   });
 */

import { createAdminClient } from "@/lib/supabase-admin";

// ─── 監査ログ アクション一覧 ───────────────────────────────────────────────────

export type AuditAction =
  | "publish"
  | "unpublish"
  | "delete_project"
  | "export_html"
  | "export_css"
  | "export_json"
  | "export_wordpress"
  | "export_zip"
  | "lead_export"
  | "lead_status_update"
  | "billing_upgrade"
  | "billing_cancel"
  | "form_submit"
  | "form_config_update"
  | "project_create"
  | "project_update";

// ─── セキュリティイベント種別 ──────────────────────────────────────────────────

export type SecurityEventType =
  | "rate_limit_exceeded"
  | "mass_generation"
  | "export_spam"
  | "form_spam"
  | "webhook_abuse"
  | "consecutive_auth_fail"
  | "suspicious_ip"
  | "input_size_exceeded"
  | "ownership_violation";

export type SecuritySeverity = "low" | "medium" | "high" | "critical";

// ─── パラメータ型 ─────────────────────────────────────────────────────────────

export interface AuditLogParams {
  userId: string;
  action: AuditAction;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  /** NextRequest — IP / User-Agent を自動抽出 */
  req?: Request;
  ip?: string;
  userAgent?: string;
}

export interface SecurityEventParams {
  eventType: SecurityEventType;
  userId?: string;
  ip?: string;
  severity?: SecuritySeverity;
  metadata?: Record<string, unknown>;
}

// ─── IP / UA 取得 ─────────────────────────────────────────────────────────────

function extractIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function extractUa(req: Request): string {
  return req.headers.get("user-agent") ?? "unknown";
}

// ─── メイン関数 ───────────────────────────────────────────────────────────────

/**
 * 監査ログを記録する（fire-and-forget）。
 * await なしで呼び出してよい。エラーは console.error のみ。
 */
export function logAudit(params: AuditLogParams): void {
  const admin = createAdminClient();
  const ip = params.ip ?? (params.req ? extractIp(params.req) : null);
  const userAgent = params.userAgent ?? (params.req ? extractUa(params.req) : null);

  admin
    .from("audit_logs")
    .insert({
      user_id:     params.userId,
      action:      params.action,
      target_type: params.targetType ?? null,
      target_id:   params.targetId ?? null,
      metadata:    params.metadata ?? {},
      ip_address:  ip,
      user_agent:  userAgent,
    })
    .then(({ error }) => {
      if (error) console.error("[audit-logger] insert failed:", error.message);
    });
}

/**
 * セキュリティイベントを記録する（fire-and-forget）。
 * await なしで呼び出してよい。エラーは console.error のみ。
 */
export function logSecurityEvent(params: SecurityEventParams): void {
  const admin = createAdminClient();

  admin
    .from("security_events")
    .insert({
      event_type:  params.eventType,
      user_id:     params.userId ?? null,
      ip_address:  params.ip ?? null,
      severity:    params.severity ?? "medium",
      metadata:    params.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) console.error("[audit-logger] security_event insert failed:", error.message);
    });
}

/**
 * レートリミット超過を security_events に記録するショートハンド。
 */
export function logRateLimitExceeded(params: {
  userId?: string;
  ip: string;
  action: string;
  count: number;
  limit: number;
}): void {
  logSecurityEvent({
    eventType: "rate_limit_exceeded",
    userId:    params.userId,
    ip:        params.ip,
    severity:  params.count >= params.limit * 3 ? "high" : "medium",
    metadata: {
      action: params.action,
      count:  params.count,
      limit:  params.limit,
    },
  });
}
