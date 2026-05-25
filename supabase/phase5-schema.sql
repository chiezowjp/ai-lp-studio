-- ============================================================
-- AI LP STUDIO — Phase 5 スキーマ（LP公開機能）
-- Supabase SQL エディタ で実行してください
-- ============================================================

-- ─── projects テーブル拡張 ────────────────────────────────────────────────────

-- 公開 URL スラッグ（UNIQUE・nullable は未設定プロジェクト用）
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS slug            TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_published    BOOLEAN      NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS published_at    TIMESTAMPTZ,
  -- SEO
  ADD COLUMN IF NOT EXISTS seo_title       TEXT,
  ADD COLUMN IF NOT EXISTS seo_description TEXT,
  -- OGP
  ADD COLUMN IF NOT EXISTS og_image        TEXT,
  -- Favicon
  ADD COLUMN IF NOT EXISTS favicon_url     TEXT,
  -- 上級者向け
  ADD COLUMN IF NOT EXISTS custom_css          TEXT,
  ADD COLUMN IF NOT EXISTS custom_head_html    TEXT,
  -- robots
  ADD COLUMN IF NOT EXISTS noindex         BOOLEAN NOT NULL DEFAULT FALSE;

-- slug の高速検索インデックス
CREATE INDEX IF NOT EXISTS projects_slug_idx
  ON public.projects (slug)
  WHERE slug IS NOT NULL;

-- 公開中プロジェクトの一覧取得用インデックス（将来の公開一覧ページ向け）
CREATE INDEX IF NOT EXISTS projects_published_idx
  ON public.projects (is_published, published_at DESC)
  WHERE is_published = TRUE;

-- ─── 動作確認クエリ（コメントアウト済み）─────────────────────────────────────
-- SELECT id, title, slug, is_published, published_at, seo_title, noindex
-- FROM public.projects
-- ORDER BY updated_at DESC LIMIT 20;
