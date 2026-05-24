-- ============================================================
-- AI LP STUDIO — Phase 2 スキーマ
-- Supabase SQL エディタ で実行してください
-- ============================================================

-- ─── profiles テーブル ────────────────────────────────────────────────────────
-- ユーザーのプラン情報を管理する。
-- id は auth.users.id と一致させ、認証ユーザーに 1:1 で紐付ける。

CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type     TEXT NOT NULL DEFAULT 'trial'
                  CHECK (plan_type IN ('trial', 'pro', 'expired')),
  trial_ends_at TIMESTAMPTZ,
  is_admin      BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- RLS 有効化（Service Role Key でのみ書き込みを許可）
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 自分のプロファイルは SELECT 可（フロントエンドから直接は読まないが念のため）
CREATE POLICY "profiles: self read"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- INSERT / UPDATE / DELETE は Service Role のみ（API Route から admin クライアントで操作）

-- ─── usage_events テーブル ────────────────────────────────────────────────────
-- AI 生成・解析・編集の使用履歴を記録する。
-- 月次集計は /api/usage が行う。

CREATE TABLE IF NOT EXISTS public.usage_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL
                CHECK (event_type IN ('generate', 'analyze', 'ai_edit')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- user_id + created_at の複合インデックス（月次集計クエリ用）
CREATE INDEX IF NOT EXISTS usage_events_user_month
  ON public.usage_events (user_id, created_at DESC);

-- RLS 有効化
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- INSERT / SELECT は Service Role のみ（API Route から admin クライアントで操作）
-- ユーザーに直接アクセス権を与えない（改ざん防止）

-- ─── 動作確認クエリ（コメントアウト済み）─────────────────────────────────────
-- SELECT * FROM public.profiles;
-- SELECT * FROM public.usage_events ORDER BY created_at DESC LIMIT 20;
