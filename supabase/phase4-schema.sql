-- ============================================================
-- AI LP STUDIO — Phase 4 スキーマ（Square 課金）
-- Supabase SQL エディタ で実行してください
-- ============================================================

-- ─── profiles テーブル拡張 ────────────────────────────────────────────────────
-- Square 課金に必要なカラムを追加する。
-- IF NOT EXISTS で冪等実行可能。

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS square_customer_id      TEXT,
  ADD COLUMN IF NOT EXISTS square_subscription_id  TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS billing_status          TEXT DEFAULT 'none'
    CHECK (billing_status IN ('none', 'active', 'past_due', 'canceled')),
  ADD COLUMN IF NOT EXISTS canceled_at             TIMESTAMPTZ;

-- ─── billing_events テーブル ──────────────────────────────────────────────────
-- Square Webhook イベントを記録する。
-- square_event_id に UNIQUE 制約を付けることで冪等処理を保証する。

CREATE TABLE IF NOT EXISTS public.billing_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  square_event_id  TEXT        NOT NULL UNIQUE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type       TEXT        NOT NULL,
  raw_payload      JSONB,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS billing_events_user_id
  ON public.billing_events (user_id);

CREATE INDEX IF NOT EXISTS billing_events_processed_at
  ON public.billing_events (processed_at DESC);

-- RLS 有効化（Service Role Key のみ操作可能）
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- ─── 動作確認クエリ（コメントアウト済み）─────────────────────────────────────
-- SELECT id, plan_type, billing_status, current_period_end FROM public.profiles;
-- SELECT * FROM public.billing_events ORDER BY processed_at DESC LIMIT 20;
