-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 8: CV改善・分析・UX強化
-- ─────────────────────────────────────────────────────────────────────────────

-- ─── 1. projects テーブル拡張 ─────────────────────────────────────────────────

-- Draft / Published 分離
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS published_html  TEXT,
  ADD COLUMN IF NOT EXISTS published_css   TEXT,
  ADD COLUMN IF NOT EXISTS last_published_at TIMESTAMPTZ;

-- ─── 2. analytics_events テーブル ────────────────────────────────────────────
--
-- 公開 LP から送信される計測イベント。
-- 認証不要（public 書き込み）のため bot 除外・レートリミットは API 側で実施。

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID        NOT NULL,   -- project への参照（CASCADE で自動削除）
  visitor_id   TEXT        NOT NULL,   -- localStorage に保存したランダム UUID（ブラウザ固有）
  session_id   TEXT        NOT NULL,   -- sessionStorage に保存したランダム UUID（セッション固有）
  event_type   TEXT        NOT NULL,   -- page_view / scroll_depth / cta_click / ...
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent   TEXT,
  referrer     TEXT,
  country      TEXT,                   -- 将来: GeoIP
  device_type  TEXT        CHECK (device_type IN ('desktop', 'mobile', 'tablet', NULL))
);

-- インデックス
CREATE INDEX IF NOT EXISTS ae_project_id_idx    ON public.analytics_events (project_id);
CREATE INDEX IF NOT EXISTS ae_event_type_idx    ON public.analytics_events (event_type);
CREATE INDEX IF NOT EXISTS ae_created_at_idx    ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS ae_visitor_id_idx    ON public.analytics_events (visitor_id);
CREATE INDEX IF NOT EXISTS ae_session_id_idx    ON public.analytics_events (session_id);
-- 日別集計用
CREATE INDEX IF NOT EXISTS ae_project_day_idx   ON public.analytics_events (project_id, date_trunc('day', created_at));

-- RLS: 一般ユーザーからは参照・書き込み不可（Service Role のみ）
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
-- INSERT は API Route が Service Role で実行（ポリシーなし = 一般ユーザーは拒否）

-- ─── 3. heatmap_events テーブル ──────────────────────────────────────────────
--
-- クリック位置・スクロール深度などの Heatmap 用生データ。
-- analytics_events と分離して将来の可視化を容易にする。

CREATE TABLE IF NOT EXISTS public.heatmap_events (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL,
  visitor_id    TEXT        NOT NULL,
  session_id    TEXT        NOT NULL,
  event_type    TEXT        NOT NULL,   -- click / scroll / hover / rage_click
  -- クリック座標（ページ全体基準の相対位置 0.0〜1.0）
  x_ratio       FLOAT,
  y_ratio       FLOAT,
  -- スクロール深度（0〜100 %）
  scroll_pct    INT,
  -- ビューポートサイズ
  viewport_w    INT,
  viewport_h    INT,
  -- ページ高
  page_h        INT,
  metadata      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  device_type   TEXT        CHECK (device_type IN ('desktop', 'mobile', 'tablet', NULL))
);

CREATE INDEX IF NOT EXISTS he_project_id_idx ON public.heatmap_events (project_id);
CREATE INDEX IF NOT EXISTS he_event_type_idx ON public.heatmap_events (event_type);
CREATE INDEX IF NOT EXISTS he_created_at_idx ON public.heatmap_events (created_at DESC);

ALTER TABLE public.heatmap_events ENABLE ROW LEVEL SECURITY;

-- ─── 4. versions テーブル ─────────────────────────────────────────────────────
--
-- LP のスナップショット履歴。
-- 保存タイミング: publish前 / rollback前 / 手動保存 / AI改善適用前

CREATE TABLE IF NOT EXISTS public.versions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL,
  -- スナップショット本体（html + css + project_json を格納）
  snapshot_json JSONB       NOT NULL DEFAULT '{}'::jsonb,
  -- バージョンの種類・メモ
  trigger       TEXT        NOT NULL DEFAULT 'manual'
                            CHECK (trigger IN ('publish', 'rollback', 'manual', 'ai_improve', 'auto')),
  note          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS versions_project_id_idx  ON public.versions (project_id);
CREATE INDEX IF NOT EXISTS versions_user_id_idx     ON public.versions (user_id);
CREATE INDEX IF NOT EXISTS versions_created_at_idx  ON public.versions (created_at DESC);

-- RLS: オーナーのみ参照（書き込みは Service Role のみ）
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "versions_select_own" ON public.versions
  FOR SELECT USING (auth.uid() = user_id);

-- ─── 5. assets テーブル ───────────────────────────────────────────────────────
--
-- Supabase Storage に保存した画像のメタデータ管理。

CREATE TABLE IF NOT EXISTS public.assets (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL,
  project_id   UUID        REFERENCES public.projects(id) ON DELETE SET NULL,
  -- Storage の公開 URL（Supabase CDN）
  url          TEXT        NOT NULL,
  -- Storage 内のパス（削除に使用）
  storage_path TEXT        NOT NULL,
  -- ファイルメタデータ
  file_name    TEXT        NOT NULL,
  file_size    INT         NOT NULL DEFAULT 0,   -- バイト
  mime_type    TEXT        NOT NULL DEFAULT 'image/jpeg',
  width        INT,                               -- ピクセル（取得できる場合）
  height       INT,
  -- 用途タグ
  usage_type   TEXT        DEFAULT 'general'
                           CHECK (usage_type IN ('general', 'og_image', 'favicon', 'lp_image', NULL)),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS assets_user_id_idx    ON public.assets (user_id);
CREATE INDEX IF NOT EXISTS assets_project_id_idx ON public.assets (project_id);
CREATE INDEX IF NOT EXISTS assets_created_at_idx ON public.assets (created_at DESC);

-- RLS: オーナーのみ
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "assets_select_own" ON public.assets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "assets_insert_own" ON public.assets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "assets_delete_own" ON public.assets
  FOR DELETE USING (auth.uid() = user_id);

-- ─── 6. Storage バケット作成手順（SQL では実行不可 → Supabase ダッシュボードで実施）─────
--
-- Supabase ダッシュボード → Storage → New bucket:
--
--   バケット名: lp-assets
--   Public:    true（CDN 配信のため）
--   Max file size: 10 MB
--
-- フォルダ構成:
--   lp-assets/
--     {user_id}/
--       general/    ← LP 画像
--       og/         ← OGP 画像
--       favicon/    ← Favicon
--
-- ─── 7. Supabase Storage の RLS ──────────────────────────────────────────────
--
-- Storage の RLS は Supabase ダッシュボードの Storage → Policies で設定:
--
-- INSERT policy: (bucket_id = 'lp-assets') AND (auth.uid()::text = (storage.foldername(name))[1])
-- SELECT policy: bucket_id = 'lp-assets'  （public CDN 配信のため全員参照可）
-- DELETE policy: (bucket_id = 'lp-assets') AND (auth.uid()::text = (storage.foldername(name))[1])

-- ─────────────────────────────────────────────────────────────────────────────
-- Summary:
--   analytics_events  — LP 計測イベント（page_view / scroll / cta_click / ...）
--   heatmap_events    — クリック・スクロール座標（将来のヒートマップ可視化用）
--   versions          — LP スナップショット履歴（rollback 対応）
--   assets            — Supabase Storage 画像メタデータ
--   projects 追加列   — published_html / published_css / last_published_at
-- ─────────────────────────────────────────────────────────────────────────────
