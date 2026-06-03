import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { HeadInjector } from "./HeadInjector";
import LPRenderer from "./LPRenderer";
import FormWidget from "@/components/FormWidget";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import type { FormConfig } from "@/lib/form-schema";

// ─── キャッシュ設定（1時間 ISR）─────────────────────────────────────────────
// 保存時に published_html/css も同時更新するため長めのキャッシュでも問題なし

export const revalidate = 3600;

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ slug: string }> };

// ─── DB 取得 ──────────────────────────────────────────────────────────────────

async function getPublishedProject(slug: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select(
      "id, title, html, css, published_html, published_css, seo_title, seo_description, og_image, favicon_url, custom_css, custom_head_html, noindex, published_at, form_config, user_id",
    )
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  return data;
}

async function getOwnerPlanType(userId: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("plan_type")
    .eq("id", userId)
    .maybeSingle();
  return (data?.plan_type as string) ?? "trial";
}

// ─── Metadata（SSR / SEO）─────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const project = await getPublishedProject(slug);

  if (!project) {
    return { title: "Not Found" };
  }

  const title       = (project.seo_title as string | null) || (project.title as string);
  const description = (project.seo_description as string | null) ?? undefined;
  const ogImage     = (project.og_image as string | null) ?? undefined;
  const favicon     = (project.favicon_url as string | null) ?? undefined;
  const noindex     = project.noindex as boolean;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: ogImage ? [{ url: ogImage }] : [],
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : [],
    },
    icons: favicon ? { icon: favicon, shortcut: favicon } : undefined,
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}

// ─── Page（Server Component）─────────────────────────────────────────────────

export default async function PublicLPPage({ params }: Props) {
  const { slug } = await params;
  const project = await getPublishedProject(slug);

  if (!project) notFound();

  // Phase 8: published_html/css を優先、なければ draft の html/css にフォールバック
  const css            = ((project.published_css as string | null) || (project.css as string)) || "";
  const rawHtml        = ((project.published_html as string | null) || (project.html as string)) || "";

  // ── サニタイズ ──────────────────────────────────────────────────────────────
  // 1. contenteditable を全形式で除去
  // 2. href="javascript:void(0)" + data-original-href を元の href に復元（順序不問）
  // 3. フォーム送信を無効化
  let html = rawHtml
    // 1. contenteditable をあらゆる形式で除去
    .replace(/\s*contenteditable(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*))?/gi, "")
    // 2. href="javascript:void(0)" を削除マーカーに置換
    .replace(/href\s*=\s*["']javascript:void\(0\)["']/gi, 'href="__VOID__"')
    // 3. __VOID__ + data-original-href のペアを data-original-href の値に復元（順序AB両対応）
    //    パターンA: href="__VOID__" ... data-original-href="orig" → href="orig"
    .replace(/href="__VOID__"(\s[^>]*?)?data-original-href="([^"]*)"/gi,
      (_, mid, orig) => `href="${orig}"${mid ?? ""}`)
    //    パターンB: data-original-href="orig" ... href="__VOID__" → href="orig"
    .replace(/data-original-href="([^"]*)"(\s[^>]*?)?href="__VOID__"/gi,
      (_, orig, mid) => `href="${orig}"${mid ?? ""}`)
    // 4. 残った __VOID__（data-original-href が無いもの）を除去
    .replace(/\s*href="__VOID__"/gi, "")
    // 5. 残った data-original-href（正しい href がすでにある場合）を除去
    .replace(/\s*data-original-href="[^"]*"/gi, "")
    // 6. エディター用クラス(lp-eh/lp-ea)を除去
    .replace(/\blp-e[ah]\b\s*/g, "")
    // 9. 外部リンクを新しいタブで開く（target="_blank" + rel="noopener noreferrer" を付与）
    .replace(/<a\b([^>]*?)>/gi, (match, attrs) => {
      // すでに target がある場合はスキップ
      if (/\btarget\s*=/i.test(attrs)) return match;
      // anchor (#...) や javascript: は対象外
      const hrefMatch = attrs.match(/href\s*=\s*["']([^"']*)["']/i);
      const href = hrefMatch?.[1] ?? "";
      if (!href || href.startsWith("#") || href.startsWith("javascript:") || href === "") return match;
      return `<a${attrs} target="_blank" rel="noopener noreferrer">`;
    })
    // 7. data-lp-onclick 等（buildContent が退避したイベントハンドラ）を元に戻す
    .replace(/data-lp-(onclick|onmousedown|onmouseup|onpointerdown|ontouchstart|onpointerup)\s*=\s*"([^"]*)"/gi,
      (_, attr, val) => `${attr}="${val}"`)
    // 8. フォーム送信無効化
    .replace(/(<form\b[^>]*?)\s+action\s*=\s*(?:"[^"]*"|'[^']*')/gi, '$1 action="javascript:void(0)"');
  const customCss      = (project.custom_css as string | null) || "";
  const customHeadHtml = (project.custom_head_html as string | null) || "";
  const formConfig     = (project.form_config as FormConfig | null);
  const userId         = project.user_id as string;
  const projectId      = project.id as string;

  // フォームウィジェット表示のためにオーナーのプランを確認
  const isPro = formConfig?.enabled
    ? (await getOwnerPlanType(userId)) === "pro"
    : false;

  return (
    // w-full で root layout の flex body に対応
    <div className="w-full">
      {/* LP スタイル */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {/* LP 本体 HTML（SSR + script 実行対応）*/}
      <LPRenderer html={html} />

      {/* custom_head_html をクライアント側で <head> に注入 */}
      {customHeadHtml && <HeadInjector html={customHeadHtml} />}

      {/* フォームウィジェット（Phase 6） */}
      {formConfig?.enabled && (
        <FormWidget config={formConfig} slug={slug} isPro={isPro} />
      )}

      {/* Analytics トラッカー（Phase 8 — クライアントサイド・非同期） */}
      <AnalyticsTracker projectId={projectId} />
    </div>
  );
}
