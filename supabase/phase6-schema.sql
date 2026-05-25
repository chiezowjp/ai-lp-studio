-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 6: フォーム送信 / リード取得
-- ─────────────────────────────────────────────────────────────────────────────

-- projects テーブルに form_config カラム追加
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS form_config JSONB;

-- leads テーブル作成
CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_slug  TEXT,
  user_id       UUID        NOT NULL,   -- プロジェクトオーナーの user_id
  form_name     TEXT        NOT NULL DEFAULT 'contact',
  payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT,
  user_agent    TEXT,
  referrer      TEXT,
  status        TEXT        NOT NULL DEFAULT 'new'
                            CHECK (status IN ('new','contacted','archived'))
);

-- インデックス
CREATE INDEX IF NOT EXISTS leads_project_id_idx   ON public.leads (project_id);
CREATE INDEX IF NOT EXISTS leads_user_id_idx      ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS leads_submitted_at_idx ON public.leads (submitted_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON public.leads (status);

-- RLS 有効化
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS ポリシー: オーナー（user_id）のみ参照・更新可能
-- ※ 挿入は Service Role Key (admin) で行うため INSERT ポリシー不要
CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "leads_update_own" ON public.leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "leads_delete_own" ON public.leads
  FOR DELETE USING (auth.uid() = user_id);
