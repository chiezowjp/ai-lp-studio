/**
 * lib/rate-limiter.ts — インメモリ レートリミッター
 *
 * Next.js サーバー上で動作するシンプルなスライディングウィンドウ方式。
 * 単一インスタンス構成（Vercel Serverless の場合はコールドスタート毎にリセット）
 * に適している。マルチインスタンスが必要な場合は Redis への移行を検討。
 *
 * ─── 上限仕様 ──────────────────────────────────────────────────────────────
 *
 *  アクション       Trial   Pro      ウィンドウ
 *  generate         3/min  20/min    60秒
 *  analyze          5/min  30/min    60秒
 *  ai_edit          10/min 60/min    60秒
 *  form_submit      5/hr   20/hr     3600秒（IP ベース）
 *  export           5/min  30/min    60秒
 */

export type RateLimitAction =
  | "generate"
  | "analyze"
  | "ai_edit"
  | "form_submit"
  | "export";

export type PlanKey = "trial" | "pro" | "expired";

// ─── 上限設定 ─────────────────────────────────────────────────────────────────

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

const LIMITS: Record<RateLimitAction, Record<PlanKey, RateLimitConfig>> = {
  generate: {
    trial:   { maxRequests: 3,  windowMs: 60_000 },
    pro:     { maxRequests: 20, windowMs: 60_000 },
    expired: { maxRequests: 0,  windowMs: 60_000 },
  },
  analyze: {
    trial:   { maxRequests: 5,  windowMs: 60_000 },
    pro:     { maxRequests: 30, windowMs: 60_000 },
    expired: { maxRequests: 0,  windowMs: 60_000 },
  },
  ai_edit: {
    trial:   { maxRequests: 10, windowMs: 60_000 },
    pro:     { maxRequests: 60, windowMs: 60_000 },
    expired: { maxRequests: 0,  windowMs: 60_000 },
  },
  form_submit: {
    trial:   { maxRequests: 5,  windowMs: 3_600_000 },
    pro:     { maxRequests: 20, windowMs: 3_600_000 },
    expired: { maxRequests: 0,  windowMs: 3_600_000 },
  },
  export: {
    trial:   { maxRequests: 0,  windowMs: 60_000 },
    pro:     { maxRequests: 30, windowMs: 60_000 },
    expired: { maxRequests: 0,  windowMs: 60_000 },
  },
};

// ─── インメモリストア ─────────────────────────────────────────────────────────

interface WindowEntry {
  timestamps: number[]; // リクエストタイムスタンプのリスト（スライディングウィンドウ）
}

// グローバルにシングルトンとして保持（Next.js モジュールキャッシュを利用）
const store = new Map<string, WindowEntry>();

// メモリリーク防止: 1時間毎に期限切れエントリを削除
const CLEANUP_INTERVAL_MS = 3_600_000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, entry] of store.entries()) {
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}

// ─── パブリック API ───────────────────────────────────────────────────────────

export interface RateLimitResult {
  /** true = リクエスト許可 */
  allowed: boolean;
  /** 許可された場合の現在のカウント */
  count: number;
  /** 拒否された場合の待機秒数 */
  retryAfter: number;
  /** ウィンドウ内の上限 */
  limit: number;
}

/**
 * レートリミットをチェックし、カウントをインクリメントする。
 *
 * @param key      識別キー（例: `ip:1.2.3.4:generate` / `user:uuid:generate`）
 * @param action   レート制限アクション
 * @param planType ユーザーのプラン
 * @returns RateLimitResult
 */
export function checkRateLimit(
  key: string,
  action: RateLimitAction,
  planType: PlanKey,
): RateLimitResult {
  cleanup();

  const config = LIMITS[action][planType];

  // expired / 上限0 は即ブロック（plan-guard で事前チェック済みのはずだが二重防衛）
  if (config.maxRequests === 0) {
    return { allowed: false, count: 0, retryAfter: 60, limit: 0 };
  }

  const now = Date.now();
  const windowStart = now - config.windowMs;

  let entry = store.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // ウィンドウ外のタイムスタンプを削除
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  const count = entry.timestamps.length;

  if (count >= config.maxRequests) {
    // 最古のタイムスタンプがウィンドウを抜ける時間を計算
    const oldest = entry.timestamps[0] ?? now;
    const retryAfter = Math.ceil((oldest + config.windowMs - now) / 1000);
    return { allowed: false, count, retryAfter: Math.max(1, retryAfter), limit: config.maxRequests };
  }

  entry.timestamps.push(now);
  return { allowed: true, count: count + 1, retryAfter: 0, limit: config.maxRequests };
}

/**
 * IP アドレスとユーザー ID の両方でレートリミットをチェックする。
 * どちらか一方が上限に達した場合はブロック。
 *
 * @param ip       クライアント IP アドレス
 * @param userId   認証ユーザーの ID（anon の場合は null）
 * @param action   レート制限アクション
 * @param planType ユーザーのプラン
 */
export function checkRateLimitBoth(
  ip: string,
  userId: string | null,
  action: RateLimitAction,
  planType: PlanKey,
): RateLimitResult {
  const ipResult = checkRateLimit(`ip:${ip}:${action}`, action, planType);
  if (!ipResult.allowed) return ipResult;

  if (userId) {
    const userResult = checkRateLimit(`user:${userId}:${action}`, action, planType);
    if (!userResult.allowed) return userResult;
    return userResult;
  }

  return ipResult;
}

/**
 * リクエストから IP アドレスを取得するヘルパー。
 * Vercel / Cloudflare など CDN 経由の場合は X-Forwarded-For を優先。
 */
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}
