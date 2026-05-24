/**
 * POST /api/analytics/event
 *
 * 公開 LP から送信される計測イベントを受け取り analytics_events に保存する。
 * 認証不要（公開エンドポイント）。Bot 除外・レートリミットをここで実施。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { isBot, detectDevice, VALID_EVENT_TYPES } from "@/lib/analytics";
import { checkRateLimit, getClientIp } from "@/lib/rate-limiter";

// analytics イベント専用レートリミット: 60件/分/IP（abuse 防止）
const ANALYTICS_RL_LIMIT = 60;
const ANALYTICS_RL_WINDOW = 60_000;

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";

  // ── Bot 除外 ──────────────────────────────────────────────────────────────
  if (isBot(ua)) {
    return NextResponse.json({ ok: true }); // 静かに捨てる
  }

  // ── レートリミット（IP ベース） ──────────────────────────────────────────
  const ip = getClientIp(req);
  const rl = checkRateLimit(`ip:${ip}:analytics`, "analyze", "pro");
  // pro 扱いで上限緩く（専用上限は下で再チェック）
  // 実際は独自カウンタで判定
  void rl; // 上記は analyze バケット流用なので独自実装

  // 簡易レートリミット（Map ベース）
  const now = Date.now();
  const rlKey = `analytics:${ip}`;
  if (!_rlStore.has(rlKey)) _rlStore.set(rlKey, []);
  const times = _rlStore.get(rlKey)!.filter((t) => now - t < ANALYTICS_RL_WINDOW);
  if (times.length >= ANALYTICS_RL_LIMIT) {
    return NextResponse.json({ ok: true }); // 静かに捨てる
  }
  times.push(now);
  _rlStore.set(rlKey, times);

  try {
    const body = await req.json() as {
      projectId?: string;
      visitorId?: string;
      sessionId?: string;
      eventType?: string;
      metadata?: Record<string, unknown>;
      referrer?: string;
    };

    const { projectId, visitorId, sessionId, eventType, metadata, referrer } = body;

    // ── バリデーション ────────────────────────────────────────────────────
    if (!projectId || !visitorId || !sessionId || !eventType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!VALID_EVENT_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }
    // UUID 形式チェック（簡易）
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    const device = detectDevice(ua);

    const admin = createAdminClient();
    const { error } = await admin.from("analytics_events").insert({
      project_id:  projectId,
      visitor_id:  visitorId.slice(0, 64),
      session_id:  sessionId.slice(0, 64),
      event_type:  eventType,
      metadata:    metadata ?? {},
      user_agent:  ua.slice(0, 500),
      referrer:    referrer ? referrer.slice(0, 500) : null,
      device_type: device,
    });

    if (error) {
      console.error("[analytics/event] insert error:", error.message);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // クライアントにはエラー出さない
  }
}

// ─── インメモリ レートリミットストア（analytics 専用） ────────────────────────
const _rlStore = new Map<string, number[]>();
// 1時間毎にクリーンアップ
setInterval(() => {
  const cutoff = Date.now() - 3_600_000;
  for (const [k, times] of _rlStore) {
    const filtered = times.filter((t) => t > cutoff);
    if (filtered.length === 0) _rlStore.delete(k);
    else _rlStore.set(k, filtered);
  }
}, 3_600_000);
