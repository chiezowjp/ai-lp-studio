-- ============================================================
-- AI LP STUDIO — Phase 4b スキーマ（課金状態管理拡張）
-- Supabase SQL エディタ で実行してください
-- phase4-schema.sql を先に適用済みであること
-- ============================================================

-- ─── profiles テーブル拡張 ────────────────────────────────────────────────────

-- Grace Period 終了日時（支払い失敗時に now() + 3日 をセット）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ;

-- Pro 化した日時（usage_reset の起点として使用）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ;

-- 使用量カウントの起点（Pro 化・サブスク更新のたびに更新）
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS usage_reset_at TIMESTAMPTZ;

-- billing_status の許容値を拡張（trialing / expired を追加）
-- まず既存の CHECK 制約を削除して再作成する
DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  SELECT conname INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'public.profiles'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%billing_status%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', constraint_name);
  END IF;
END;
$$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_billing_status_check
  CHECK (billing_status IN ('none', 'trialing', 'active', 'canceled', 'past_due', 'expired'));

-- 既存の 'none' を 'trialing' に移行（trial プランのユーザー）
UPDATE public.profiles
SET billing_status = 'trialing'
WHERE billing_status = 'none'
  AND plan_type = 'trial';

-- ─── billing_events テーブル拡張 ──────────────────────────────────────────────
-- phase4-schema.sql で作成済みの場合は以下のカラムを追加する

ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS billing_status TEXT,
  ADD COLUMN IF NOT EXISTS amount         INTEGER,
  ADD COLUMN IF NOT EXISTS currency       TEXT;

-- ─── 動作確認クエリ（コメントアウト済み）─────────────────────────────────────
-- SELECT id, plan_type, billing_status, grace_period_ends_at,
--        current_period_end, plan_started_at, usage_reset_at
-- FROM public.profiles;
--
-- SELECT id, square_event_id, event_type, billing_status, amount, currency
-- FROM public.billing_events ORDER BY processed_at DESC LIMIT 20;
