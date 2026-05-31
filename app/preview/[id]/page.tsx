import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient } from "@/lib/supabase-admin";
import { HeadInjector } from "@/app/p/[slug]/HeadInjector";

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = { params: Promise<{ id: string }> };

// ─── DB 取得 ──────────────────────────────────────────────────────────────────

async function getProjectForPreview(id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("projects")
    .select("id, title, html, css, published_css, project_json, custom_css, custom_head_html, slug, is_published")
    .eq("id", id)
    .maybeSingle();
  return data;
}

// ─── Metadata（noindex 固定）────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const project = await getProjectForPreview(id);

  return {
    title: project ? `[プレビュー] ${project.title as string}` : "Preview",
    robots: { index: false, follow: false },
  };
}

// ─── Page（Server Component）─────────────────────────────────────────────────

export default async function PreviewPage({ params }: Props) {
  const { id } = await params;
  const project = await getProjectForPreview(id);

  if (!project) notFound();

  // CSS の優先順位:
  // 1. project_json.effective_css（保存時に含めた画像・ビジュアル込み最終 CSS）
  // 2. published_css（公開時に保存した effectiveCss）
  // 3. css（AI 生成の基本 CSS — フォールバック）
  const projectJson   = project.project_json as Record<string, unknown> | null;
  const css           = (projectJson?.effective_css as string | null)
                     ?? (project.published_css as string | null)
                     ?? (project.css as string)
                     ?? "";
  const customCss     = (project.custom_css as string | null) || "";
  // LP 内の native <form action="..."> を無効化（FormWidget を使うため）
  const html          = ((project.html as string) || "").replace(
    /(<form\b[^>]*?)\s+action\s*=\s*(?:"[^"]*"|'[^']*')/gi,
    '$1 action="javascript:void(0)"',
  );
  const customHeadHtml = (project.custom_head_html as string | null) || "";
  const isPublished   = project.is_published as boolean;
  const slug          = project.slug as string | null;

  // 公開URLは相対パスを使用（NEXT_PUBLIC_APP_URL が未設定でも動作する）
  const publicUrl = slug ? `/p/${slug}` : null;

  return (
    <div className="w-full">
      {/* プレビューバナー */}
      <div className="w-full bg-gray-900 text-white px-4 py-2.5 flex items-center justify-between gap-3 text-xs print:hidden z-50 sticky top-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-[#00AFCC]">AI LP STUDIO</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-300">
            {isPublished ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-green-400 mr-1" />
                公開中
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
                プレビュー（未公開）
              </>
            )}
          </span>
          <span className="text-gray-500 truncate max-w-[200px]">{project.title as string}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isPublished && publicUrl && (
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1 bg-[#00AFCC] hover:bg-[#0099b3] rounded-lg font-semibold transition-colors"
            >
              公開URLを開く →
            </a>
          )}
          <a
            href={`/?p=${id}`}
            className="px-2.5 py-1 border border-gray-600 hover:border-gray-400 rounded-lg text-gray-300 hover:text-white transition-colors"
          >
            編集する
          </a>
        </div>
      </div>

      {/* LP スタイル */}
      <style dangerouslySetInnerHTML={{ __html: css }} />
      {customCss && <style dangerouslySetInnerHTML={{ __html: customCss }} />}

      {/* LP 本体 */}
      <div dangerouslySetInnerHTML={{ __html: html }} />

      {/* custom_head_html */}
      {customHeadHtml && <HeadInjector html={customHeadHtml} />}
    </div>
  );
}
