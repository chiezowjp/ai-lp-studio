-- Phase 9: アクセス解析・広告タグ設定
-- Meta Pixel ID / GA4 測定ID / GTM ID を projects テーブルに追加

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS meta_pixel_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS ga4_id        TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS gtm_id        TEXT DEFAULT NULL;
