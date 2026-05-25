-- ============================================================
-- AI LP Studio — 全フェーズ統合スキーマ
-- 新規 Supabase プロジェクト用（Phase 2〜8 一括適用）
--
-- 適用方法:
--   Supabase ダッシュボード → SQL Editor → このファイルを貼り付け → Run
--
-- 冪等設計: 何度実行しても安全（IF NOT EXISTS / DROP IF EXISTS）
-- ============================================================


-- ─────────────────────────────────────────────────────────────
-- SECTION 1: 基盤テーブル（projects / profiles / usage_events）
-- ─────────────────────────────────────────────────────────────

-- ─── updated_at 自動更新トリガー関数 ─────────────────────────

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── projects テーブル（Phase 2〜8 全カラム込み）────────────

CREATE TABLE IF NOT EXISTS public.projects (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL DEFAULT 'Untitled LP',
  html                TEXT        NOT NULL DEFAULT '',
  css                 TEXT        NOT NULL DEFAULT '',
  project_json        JSONB       NOT NULL DEFAULT '{}'::jsonb,
  thumbnail           TEXT,
  -- Phase 5: 公開機能
  slug                TEXT        UNIQUE,
  is_published        BOOLEAN     NOT NULL DEFAULT FALSE,
  published_at        TIMESTAMPTZ,
  seo_title           TEXT,
  seo_description     TEXT,
  og_image            TEXT,
  favicon_url         TEXT,
  custom_css          TEXT,
  custom_head_html    TEXT,
  noindex             BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Phase 6: フォーム
  form_config         JSONB,
  -- Phase 8: Draft / Published 分離
  published_html      TEXT,
  published_css       TEXT,
  last_published_at   TIMESTAMPTZ,
  -- タイムスタンプ
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS projects_user_id_idx
  ON public.projects (user_id);
CREATE INDEX IF NOT EXISTS projects_slug_idx
  ON public.projects (slug) WHERE slug IS NOT NULL;
CREATE INDEX IF NOT EXISTS projects_published_idx
  ON public.projects (is_published, published_at DESC) WHERE is_published = TRUE;

DROP TRIGGER IF EXISTS projects_updated_at ON public.projects;
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── profiles テーブル ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.profiles (
  id                    UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type             TEXT        NOT NULL DEFAULT 'trial'
                          CHECK (plan_type IN ('trial', 'pro', 'expired')),
  trial_ends_at         TIMESTAMPTZ,
  is_admin              BOOLEAN     NOT NULL DEFAULT false,
  -- Phase 4: Square 課金
  square_customer_id    TEXT,
  square_subscription_id TEXT,
  current_period_end    TIMESTAMPTZ,
  billing_status        TEXT        DEFAULT 'trialing'
    CHECK (billing_status IN ('none', 'trialing', 'active', 'canceled', 'past_due', 'expired')),
  canceled_at           TIMESTAMPTZ,
  -- Phase 4b: 課金拡張
  grace_period_ends_at  TIMESTAMPTZ,
  plan_started_at       TIMESTAMPTZ,
  usage_reset_at        TIMESTAMPTZ,
  -- タイムスタンプ
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── usage_events テーブル ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.usage_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL
    CHECK (event_type IN ('generate', 'analyze', 'ai_edit')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_user_month
  ON public.usage_events (user_id, created_at DESC);

-- ─── billing_events テーブル ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.billing_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  square_event_id  TEXT        NOT NULL UNIQUE,
  user_id          UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type       TEXT        NOT NULL,
  raw_payload      JSONB,
  billing_status   TEXT,
  amount           INTEGER,
  currency         TEXT,
  processed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS billing_events_user_id
  ON public.billing_events (user_id);
CREATE INDEX IF NOT EXISTS billing_events_processed_at
  ON public.billing_events (processed_at DESC);


-- ─────────────────────────────────────────────────────────────
-- SECTION 2: フォーム・リード（Phase 6）
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.leads (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  project_slug  TEXT,
  user_id       UUID        NOT NULL,
  form_name     TEXT        NOT NULL DEFAULT 'contact',
  payload       JSONB       NOT NULL DEFAULT '{}'::jsonb,
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address    TEXT,
  user_agent    TEXT,
  referrer      TEXT,
  status        TEXT        NOT NULL DEFAULT 'new'
                  CHECK (status IN ('new', 'contacted', 'archived'))
);

CREATE INDEX IF NOT EXISTS leads_project_id_idx   ON public.leads (project_id);
CREATE INDEX IF NOT EXISTS leads_user_id_idx      ON public.leads (user_id);
CREATE INDEX IF NOT EXISTS leads_submitted_at_idx ON public.leads (submitted_at DESC);
CREATE INDEX IF NOT EXISTS leads_status_idx       ON public.leads (status);


-- ─────────────────────────────────────────────────────────────
-- SECTION 3: セキュリティ・監査（Phase 7）
-- ─────────────────────────────────────────────────────────────

-- ─── audit_logs ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx    ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx     ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- ─── security_events ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  user_id     UUID,
  ip_address  TEXT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  severity    TEXT        NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS security_events_event_type_idx  ON public.security_events (event_type);
CREATE INDEX IF NOT EXISTS security_events_user_id_idx     ON public.security_events (user_id);
CREATE INDEX IF NOT EXISTS security_events_ip_address_idx  ON public.security_events (ip_address);
CREATE INDEX IF NOT EXISTS security_events_created_at_idx  ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_severity_idx    ON public.security_events (severity);


-- ─────────────────────────────────────────────────────────────
-- SECTION 4: Analytics・Version・Asset（Phase 8）
-- ─────────────────────────────────────────────────────────────

-- ─── analytics_events ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL,
  visitor_id   TEXT        NOT NULL,
  session_id   TEXT        NOT NULL,
  event_type   TEXT        NOT NULL,
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent   TEXT,
  referrer     TEXT,
  country      TEXT,
  device_type  TEXT        CHECK (device_type IN ('desktop', 'mobile', 'tablet', NULL))
);

CREATE INDEX IF NOT EXISTS ae_project_id_idx  ON public.analytics_events (project_id);
CREATE INDEX IF NOT EXISTS ae_event_type_idx  ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS ae_created_at_idx  ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ae_visitor_id_idx  ON public.analytics_events (visitor_id);
CREATE INDEX IF NOT EXISTS ae_session_id_idx  ON public.analytics_events (session_id);
-- ae_project_day_idx: date_trunc('day', timestamptz) は STABLE のためインデックス式に使用不可。
-- ae_created_at_idx (created_at DESC) で日別範囲クエリをカバー。

-- ─── heatmap_events ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.heatmap_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL,
  visitor_id  TEXT        NOT NULL,
  session_id  TEXT        NOT NULL,
  event_type  TEXT        NOT NULL,
  x_ratio     FLOAT,
  y_ratio     FLOAT,
  scroll_pct  INT,
  viewport_w  INT,
  viewport_h  INT,
  page_h      INT,
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_type TEXT        CHECK (device_type IN ('desktop', 'mobile', 'tablet', NULL))
);

CREATE INDEX IF NOT EXISTS he_project_id_idx ON public.heatmap_events (project_id);
CREATE INDEX IF NOT EXISTS he_event_type_idx ON public.heatmap_events (event_type);
CREATE INDEX IF NOT EXISTS he_created_at_idx ON public.heatmap_events (created_at DESC);

-- ─── versions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL,
  snapshot_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  trigger       TEXT        NOT NULL DEFAULT 'manual'
    CHECK (trigger IN ('publish', 'rollback', 'manual', 'ai_improve', 'auto')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS versions_project_id_idx ON public.versions (project_id);
CREATE INDEX IF NOT EXISTS versions_user_id_idx    ON public.versions (user_id);
CREATE INDEX IF NOT EXISTS versions_created_at_idx ON public.versions (created_at DESC);

-- ─── assets ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.assets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,
  project_id   UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  url          TEXT        NOT NULL,
  storage_path TEXT        NOT NULL,
  file_name    TEXT        NOT NULL,
  file_size    INT         NOT NULL DEFAULT 0,
  mime_type    TEXT        NOT NULL DEFAULT 'image/jpeg',
  width        INT,
  height       INT,
  usage_type   TEXT        DEFAULT 'general'
    CHECK (usage_type IN ('general', 'og_image', 'favicon', 'lp_image', NULL)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_user_id_idx    ON public.assets (user_id);
CREATE INDEX IF NOT EXISTS assets_project_id_idx ON public.assets (project_id);
CREATE INDEX IF NOT EXISTS assets_created_at_idx ON public.assets (created_at DESC);


-- ─────────────────────────────────────────────────────────────
-- SECTION 5: RLS（全テーブル）
-- ─────────────────────────────────────────────────────────────

-- ─── projects ────────────────────────────────────────────────

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects_select_own"       ON public.projects;
DROP POLICY IF EXISTS "projects_select_published" ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own"       ON public.projects;
DROP POLICY IF EXISTS "projects_update_own"       ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own"       ON public.projects;

CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

-- 公開済み LP は anon ユーザーも参照可（/p/[slug] の SSR 用）
CREATE POLICY "projects_select_published" ON public.projects
  FOR SELECT USING (is_published = true);

CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- ─── profiles ────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- ─── usage_events ────────────────────────────────────────────

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events_select_own" ON public.usage_events;

CREATE POLICY "usage_events_select_own" ON public.usage_events
  FOR SELECT USING (auth.uid() = user_id);

-- ─── billing_events ──────────────────────────────────────────

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "billing_events_select_own" ON public.billing_events;

CREATE POLICY "billing_events_select_own" ON public.billing_events
  FOR SELECT USING (auth.uid() = user_id);

-- ─── leads ───────────────────────────────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select_own" ON public.leads;
DROP POLICY IF EXISTS "leads_update_own" ON public.leads;
DROP POLICY IF EXISTS "leads_delete_own" ON public.leads;

CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "leads_update_own" ON public.leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "leads_delete_own" ON public.leads
  FOR DELETE USING (auth.uid() = user_id);

-- ─── audit_logs（自分のログのみ参照）────────────────────────

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ─── security_events（ユーザー閲覧不可・管理者のみ）─────────

ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- ポリシーなし = authenticated ユーザーも閲覧不可

-- ─── analytics_events（Service Role のみ書き込み）───────────

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- ポリシーなし = Service Role でのみアクセス（API Route 経由）

-- ─── heatmap_events ──────────────────────────────────────────

ALTER TABLE public.heatmap_events ENABLE ROW LEVEL SECURITY;
-- ポリシーなし = Service Role のみ

-- ─── versions（オーナーのみ参照）────────────────────────────

ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "versions_select_own" ON public.versions;

CREATE POLICY "versions_select_own" ON public.versions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── assets（オーナーのみ）───────────────────────────────────

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "assets_select_own" ON public.assets;
DROP POLICY IF EXISTS "assets_insert_own" ON public.assets;
DROP POLICY IF EXISTS "assets_delete_own" ON public.assets;

CREATE POLICY "assets_select_own" ON public.assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "assets_insert_own" ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assets_delete_own" ON public.assets
  FOR DELETE USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────
-- SECTION 6: 新規ユーザー登録時に profiles を自動作成するトリガー
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, plan_type, billing_status, created_at, updated_at)
  VALUES (NEW.id, 'trial', 'trialing', NOW(), NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- SECTION 7: Storage RLS（lp-assets バケット）
-- ─────────────────────────────────────────────────────────────
-- ※ バケット「lp-assets」を先にダッシュボードから作成すること。
--   作成後にこの SQL を再実行するか、以下を別途 SQL Editor で実行。

DO $$
BEGIN
  -- lp-assets バケットが存在する場合のみ RLS を設定
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'lp-assets') THEN

    -- INSERT: 自分の user_id フォルダのみアップロード可
    DROP POLICY IF EXISTS "lp_assets_insert_own" ON storage.objects;
    EXECUTE $p$
      CREATE POLICY "lp_assets_insert_own" ON storage.objects
        FOR INSERT WITH CHECK (
          bucket_id = 'lp-assets'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $p$;

    -- DELETE: 自分の user_id フォルダのみ削除可
    DROP POLICY IF EXISTS "lp_assets_delete_own" ON storage.objects;
    EXECUTE $p$
      CREATE POLICY "lp_assets_delete_own" ON storage.objects
        FOR DELETE USING (
          bucket_id = 'lp-assets'
          AND auth.uid()::text = (storage.foldername(name))[1]
        )
    $p$;

    RAISE NOTICE 'Storage RLS policies set for lp-assets bucket.';
  ELSE
    RAISE NOTICE 'lp-assets bucket not found. Create it first, then re-run this script.';
  END IF;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 完了確認クエリ（実行後にテーブルが正しく作成されたか確認）
-- ─────────────────────────────────────────────────────────────

SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
