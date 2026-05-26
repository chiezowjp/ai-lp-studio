// ─── Plan Types ───────────────────────────────────────────────────────────────

export type PlanType = "trial" | "pro" | "expired";

/**
 * Square 課金の状態。plan_type とは独立して管理する。
 *
 * trialing  — 無料トライアル中
 * active    — 課金中（支払い正常）
 * canceled  — 解約済み（current_period_end まで Pro 利用可）
 * past_due  — 支払い失敗中（grace_period_ends_at まで猶予）
 * expired   — 利用期限切れ
 * none      — 未課金（初期値、DB 上は trialing へ移行済み）
 */
export type BillingStatus =
  | "none"
  | "trialing"
  | "active"
  | "canceled"
  | "past_due"
  | "expired";

// ─── Square Constants ─────────────────────────────────────────────────────────

/** Pro プランの月額（税込、日本円） */
export const SQUARE_PRO_MONTHLY_PRICE = 2980;

/** Pro プランの表示用金額文字列 */
export const SQUARE_PRO_MONTHLY_PRICE_LABEL = `¥${SQUARE_PRO_MONTHLY_PRICE.toLocaleString()}`;

/**
 * Square Subscription Plan Variation ID（本番では環境変数で上書き）
 * 例: SQUARE_PRO_PLAN_VARIATION_ID=xxxxxxxxxxxxx
 * Sandbox では Payment Link (one-time) を使うため現時点では未使用
 */
export const SQUARE_PRO_PLAN_VARIATION_ID =
  process.env.SQUARE_PRO_PLAN_VARIATION_ID ?? "";

/** Grace Period の日数（支払い失敗後の猶予期間） */
export const GRACE_PERIOD_DAYS = 3;

export interface PlanLimits {
  /** 保存できるプロジェクト数 */
  maxProjects: number;
  /** 月間 LP 生成回数 */
  maxGenerate: number;
  /** 月間 参考LP解析回数 */
  maxAnalyze: number;
  /** 月間 AI編集（修正）回数 */
  maxAiEdit: number;
  /** HTML / CSS / JSON / Netlify タブのエクスポートを許可するか */
  canExport: boolean;
  /** エディター本体を使用できるか */
  canEdit: boolean;
  /** LP を公開 URL で公開できるか（Phase 5）*/
  canPublish: boolean;
  /** 本番フォーム送信・リード受信を利用できるか（Phase 6）*/
  canReceiveForms: boolean;
  // ── Phase 8 ──────────────────────────────────────────────────────────────
  /** Analytics ダッシュボードを閲覧できるか */
  canViewAnalytics: boolean;
  /** AI CV 改善提案を使用できるか */
  canAiImprove: boolean;
  /** Version 履歴・Rollback を利用できるか */
  canVersionHistory: boolean;
  /** Asset Library の最大アップロード件数（0 = 不可） */
  maxAssets: number;
}

export const PLAN_LIMITS: Record<PlanType, PlanLimits> = {
  trial: {
    maxProjects: 1,
    maxGenerate: 3,
    maxAnalyze: 3,
    maxAiEdit: 10,
    canExport: false,
    canEdit: true,
    canPublish: false,
    canReceiveForms: false,
    // Phase 8
    canViewAnalytics: false,
    canAiImprove: false,
    canVersionHistory: false,
    maxAssets: 10,
  },
  pro: {
    maxProjects: 10,
    maxGenerate: 100,
    maxAnalyze: 100,
    maxAiEdit: 300,
    canExport: true,
    canEdit: true,
    canPublish: true,
    canReceiveForms: true,
    // Phase 8
    canViewAnalytics: true,
    canAiImprove: true,
    canVersionHistory: true,
    maxAssets: 0, // 0 = 無制限
  },
  expired: {
    maxProjects: 0,
    maxGenerate: 0,
    maxAnalyze: 0,
    maxAiEdit: 0,
    canExport: false,
    canEdit: false,
    canPublish: false,
    canReceiveForms: false,
    // Phase 8
    canViewAnalytics: false,
    canAiImprove: false,
    canVersionHistory: false,
    maxAssets: 0,
  },
};

export type UsageEventType = "generate" | "analyze" | "ai_edit";

export interface UsageCounts {
  generate: number;
  analyze: number;
  ai_edit: number;
}

/** プランの表示名 */
export const PLAN_LABEL: Record<PlanType, string> = {
  trial: "トライアル",
  pro: "Pro",
  expired: "期限切れ",
};

/** プランのバッジ色 (Tailwind クラス) */
export const PLAN_BADGE_COLOR: Record<PlanType, string> = {
  trial: "bg-amber-100 text-amber-700 border-amber-200",
  pro:   "bg-[#E6F8FC] text-[#00AFCC] border-[#b3e8f4]",
  expired: "bg-red-100 text-red-600 border-red-200",
};

// ─── Pricing Data ─────────────────────────────────────────────────────────────

export interface PlanPricing {
  /** 月額（null = 無料） */
  monthly: number | null;
  /** 表示文字列 */
  label: string;
  /** サブテキスト */
  sub: string;
  /** 説明 */
  desc: string;
}

export const PLAN_PRICING: Record<"trial" | "pro", PlanPricing> = {
  trial: {
    monthly: null,
    label: "¥0",
    sub: "3日間無料",
    desc: "まずは無料で試せます",
  },
  pro: {
    monthly: 2980,
    label: "¥2,980",
    sub: "/ 月（税込）",
    desc: "すべての機能をフル活用",
  },
};

// ─── Feature Comparison ───────────────────────────────────────────────────────

export type FeatureValue = boolean | string;

export interface PlanFeature {
  /** カテゴリ（グループ見出し用） */
  category?: string;
  /** 機能名 */
  label: string;
  /** Trialでの値 */
  trial: FeatureValue;
  /** Proでの値 */
  pro: FeatureValue;
  /** Proカードで強調するか */
  highlight?: boolean;
  /** 準備中フラグ（将来実装予定） */
  comingSoon?: boolean;
}

export const PLAN_FEATURES: PlanFeature[] = [
  // ── AI生成
  { category: "AI生成・編集", label: "LP生成（月）",      trial: "3回",   pro: "100回",  highlight: true },
  {                           label: "AI編集・修正（月）", trial: "10回",  pro: "300回"  },
  {                           label: "参考LP解析（月）",   trial: "3回",   pro: "100回"  },
  // ── エクスポート
  { category: "エクスポート", label: "HTMLコピー",                trial: false, pro: true, highlight: true },
  {                           label: "CSSコピー",                 trial: false, pro: true  },
  {                           label: "JSONダウンロード",           trial: false, pro: true  },
  {                           label: "ZIPダウンロード",            trial: false, pro: true, comingSoon: true },
  // ── フォーム・リード取得（Phase 6）
  { category: "フォーム・リード", label: "フォーム設置",        trial: true,  pro: true,  highlight: true },
  {                               label: "本番フォーム送信",     trial: false, pro: true,  highlight: true },
  {                               label: "メール通知",           trial: false, pro: true  },
  {                               label: "リード管理",           trial: false, pro: true  },
  {                               label: "CSV エクスポート",     trial: false, pro: true  },
  // ── Analytics・改善（Phase 8）
  { category: "Analytics・改善", label: "Analytics閲覧",    trial: false, pro: true, highlight: true },
  {                               label: "Heatmap基盤",      trial: false, pro: true  },
  {                               label: "Asset Library",    trial: "10件", pro: "無制限", highlight: true },
  // ── 保存・管理
  { category: "保存・管理",  label: "クラウド保存",   trial: "1件", pro: "10件", highlight: true },
  {                           label: "LP複製",          trial: false, pro: true  },
  // ── 基本機能（両プラン共通）
  { category: "基本機能",    label: "プレビュー（PC/SP）", trial: true,  pro: true  },
  {                           label: "セクション追加・並び替え", trial: true, pro: true },
  {                           label: "カラー・フォント編集", trial: true, pro: true },
  {                           label: "画像挿入・管理",   trial: true,  pro: true  },
  {                           label: "商用利用",          trial: true,  pro: true  },
];

/** エクスポート系でロックされている機能のラベル一覧（LockScreen で使用） */
export const EXPORT_PRO_FEATURES = [
  "HTMLコードをコピー・ダウンロード",
  "CSSをWordPressに貼り付け",
  "JSONファイルとして書き出し",
];

// ─── Utilities ────────────────────────────────────────────────────────────────

/** 使用量が上限に達しているか */
export function isLimitReached(
  eventType: UsageEventType,
  usage: UsageCounts,
  planType: PlanType,
): boolean {
  const limits = PLAN_LIMITS[planType];
  if (eventType === "generate") return usage.generate >= limits.maxGenerate;
  if (eventType === "analyze")  return usage.analyze  >= limits.maxAnalyze;
  if (eventType === "ai_edit")  return usage.ai_edit  >= limits.maxAiEdit;
  return false;
}

/** 残り使用回数を返す */
export function remainingCount(
  eventType: UsageEventType,
  usage: UsageCounts,
  planType: PlanType,
): number {
  const limits = PLAN_LIMITS[planType];
  if (eventType === "generate") return Math.max(0, limits.maxGenerate - usage.generate);
  if (eventType === "analyze")  return Math.max(0, limits.maxAnalyze  - usage.analyze);
  if (eventType === "ai_edit")  return Math.max(0, limits.maxAiEdit   - usage.ai_edit);
  return 0;
}

/** トライアル残り日数（0 = 当日・過去） */
export function trialDaysLeft(trialEndsAt: Date | null): number | null {
  if (!trialEndsAt) return null;
  return Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86_400_000));
}
