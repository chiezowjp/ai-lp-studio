-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 7: セキュリティ・運用強化
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. audit_logs テーブル ───────────────────────────────────────────────────
--
-- 記録対象アクション:
--   publish / unpublish / export_html / export_css / export_json /
--   export_wordpress / export_zip / delete_project / billing_upgrade /
--   billing_cancel / form_submit / lead_export / lead_status_update

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL,
  action      TEXT        NOT NULL,        -- 上記アクション文字列
  target_type TEXT,                        -- "project" | "lead" | "billing" | null
  target_id   TEXT,                        -- project.id, lead.id など
  metadata    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_address  TEXT,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_user_id_idx    ON public.audit_logs (user_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx     ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_created_at_idx ON public.audit_logs (created_at DESC);

-- RLS: 管理者のみ参照（Service Role Key で INSERT、通常ユーザーは自分のログのみ参照）
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_select_own" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT / UPDATE / DELETE は Service Role Key (admin) のみ（ポリシーなし = 拒否）

-- ─── 2. security_events テーブル ─────────────────────────────────────────────
--
-- 記録対象イベント:
--   rate_limit_exceeded / mass_generation / export_spam /
--   form_spam / webhook_abuse / consecutive_auth_fail / suspicious_ip

CREATE TABLE IF NOT EXISTS public.security_events (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT        NOT NULL,
  user_id     UUID,                        -- 特定できない場合は NULL
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

-- RLS: 通常ユーザーは閲覧不可（管理者のみ Service Role Key で参照）
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
-- ポリシーなし = auth ユーザーからは一切アクセス不可

-- ─── 3. 完全 RLS ポリシー — 全テーブル ────────────────────────────────────────
-- ※ 既存ポリシーと重複する場合は DROP してから再作成する。

-- ── 3-1. projects ─────────────────────────────────────────────────────────────

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを安全に削除（存在しない場合エラーにしない）
DROP POLICY IF EXISTS "projects_select_own"  ON public.projects;
DROP POLICY IF EXISTS "projects_insert_own"  ON public.projects;
DROP POLICY IF EXISTS "projects_update_own"  ON public.projects;
DROP POLICY IF EXISTS "projects_delete_own"  ON public.projects;
-- 公開 LP 参照用ポリシー（Phase 5 で追加済みの場合も再定義）
DROP POLICY IF EXISTS "projects_select_published" ON public.projects;

CREATE POLICY "projects_select_own" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

-- 公開済み LP はどのユーザーでも（anon 含む）参照可能
CREATE POLICY "projects_select_published" ON public.projects
  FOR SELECT USING (is_published = true);

-- INSERT: 認証済みユーザーが自分の user_id でのみ挿入可（API Route 側でも検証）
CREATE POLICY "projects_insert_own" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "projects_update_own" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "projects_delete_own" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- ── 3-2. profiles ─────────────────────────────────────────────────────────────

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own"  ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert_own"  ON public.profiles;

-- 自分のプロファイルのみ参照・更新
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- INSERT は Service Role Key (trigger + admin) のみ
-- ユーザーからの直接 INSERT は拒否

-- ── 3-3. usage_events ────────────────────────────────────────────────────────

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_events_select_own"  ON public.usage_events;
DROP POLICY IF EXISTS "usage_events_insert_own"  ON public.usage_events;

-- 自分の使用量のみ参照
CREATE POLICY "usage_events_select_own" ON public.usage_events
  FOR SELECT USING (auth.uid() = user_id);

-- INSERT は Service Role Key のみ（ユーザーから直接カウントを操作させない）

-- ── 3-4. leads ───────────────────────────────────────────────────────────────

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leads_select_own"  ON public.leads;
DROP POLICY IF EXISTS "leads_update_own"  ON public.leads;
DROP POLICY IF EXISTS "leads_delete_own"  ON public.leads;

-- プロジェクトオーナーのみリードを参照・更新（user_id はオーナーの ID）
CREATE POLICY "leads_select_own" ON public.leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "leads_update_own" ON public.leads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "leads_delete_own" ON public.leads
  FOR DELETE USING (auth.uid() = user_id);

-- INSERT は Service Role Key のみ（フォーム送信エンドポイントが admin クライアント経由で挿入）

-- ── 3-5. billing_events（存在する場合） ──────────────────────────────────────

-- billing_events テーブルが存在する場合のみ適用
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'billing_events') THEN
    ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

    -- 既存ポリシーを削除
    DROP POLICY IF EXISTS "billing_events_select_own" ON public.billing_events;

    -- 自分の課金イベントのみ参照
    EXECUTE $p$
      CREATE POLICY "billing_events_select_own" ON public.billing_events
        FOR SELECT USING (auth.uid() = user_id)
    $p$;
  END IF;
END;
$$;

-- ── 3-6. audit_logs（自分のログのみ参照、INSERTは管理者のみ）─────────────────
-- 上の CREATE TABLE セクションで定義済み。

-- ── 3-7. security_events（ユーザーからは閲覧不可）────────────────────────────
-- 上の CREATE TABLE セクションで定義済み。

-- ─────────────────────────────────────────────────────────────────────────────
-- 備考:
--   - すべての INSERT / UPDATE は Service Role Key を持つ管理クライアントが実行。
--   - RLS は anon / authenticated ロールへのアクセスを最小権限に制限する。
--   - 管理者ページ (/admin/*) は API Route でユーザーの is_admin フラグを確認。
-- ─────────────────────────────────────────────────────────────────────────────
