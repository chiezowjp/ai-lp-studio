/**
 * POST /api/heatmap/event
 *
 * 公開 LP からのヒートマップイベント（クリック座標・スクロール）を保存する。
 * 認証不要。Bot 除外・レートリミット実施。
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { isBot, detectDevice } from "@/lib/analytics";
import { getClientIp } from "@/lib/rate-limiter";

const VALID_HEATMAP_TYPES = new Set(["click", "scroll", "hover", "rage_click"]);
const RL_LIMIT  = 120;
const RL_WINDOW = 60_000;
const _rl = new Map<string, number[]>();

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (isBot(ua)) return NextResponse.json({ ok: true });

  // レートリミット
  const ip = getClientIp(req);
  const key = `hm:${ip}`;
  const now = Date.now();
  const times = (_rl.get(key) ?? []).filter((t) => now - t < RL_WINDOW);
  if (times.length >= RL_LIMIT) return NextResponse.json({ ok: true });
  times.push(now);
  _rl.set(key, times);

  try {
    const body = await req.json() as {
      projectId?: string;
      visitorId?: string;
      sessionId?: string;
      eventType?: string;
      xRatio?: number;
      yRatio?: number;
      scrollPct?: number;
      viewportW?: number;
      viewportH?: number;
      pageH?: number;
      metadata?: Record<string, unknown>;
    };

    const {
      projectId, visitorId, sessionId, eventType,
      xRatio, yRatio, scrollPct, viewportW, viewportH, pageH,
      metadata,
    } = body;

    if (!projectId || !visitorId || !sessionId || !eventType) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    if (!VALID_HEATMAP_TYPES.has(eventType)) {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }
    if (!/^[0-9a-f-]{36}$/i.test(projectId)) {
      return NextResponse.json({ error: "Invalid projectId" }, { status: 400 });
    }

    const admin = createAdminClient();
    await admin.from("heatmap_events").insert({
      project_id:  projectId,
      visitor_id:  String(visitorId).slice(0, 64),
      session_id:  String(sessionId).slice(0, 64),
      event_type:  eventType,
      x_ratio:     typeof xRatio === "number" ? Math.min(1, Math.max(0, xRatio)) : null,
      y_ratio:     typeof yRatio === "number" ? Math.min(1, Math.max(0, yRatio)) : null,
      scroll_pct:  typeof scrollPct === "number" ? Math.min(100, Math.max(0, scrollPct)) : null,
      viewport_w:  viewportW ?? null,
      viewport_h:  viewportH ?? null,
      page_h:      pageH ?? null,
      device_type: detectDevice(ua),
      metadata:    metadata ?? {},
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
