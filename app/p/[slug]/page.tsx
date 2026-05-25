import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { HeadInjector } from "./HeadInjector";
import FormWidget from "@/components/FormWidget";
import AnalyticsTracker from "@/components/AnalyticsTracker";
import type { FormConfig } from "@/lib/form-schema";

// ─── キャッシュ設定（5分 ISR）────────────────────────────────────────────────

export const revalidate = 300;

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
  const html           = ((project.published_html as string | null) || (project.html as string)) || "";
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

      {/* LP 本体 HTML（SSR でレンダリング → SEO 対応）*/}
      <div dangerouslySetInnerHTML={{ __html: html }} />

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
