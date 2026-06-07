import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * PATCH /api/projects/[id]/seo
 * SEO / OGP / favicon / custom_head_html などの公開設定を保存する。
 * プランチェックなし（読み取り専用の設定保存は Trial でも可）。
 * ただし公開自体は publish エンドポイントで Pro チェックを行う。
 */
export async function PATCH(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  // 所有者確認
  const { data: existing } = await admin
    .from("projects")
    .select("user_id")
    .eq("id", id)
    .maybeSingle();

  if (!existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json() as {
    slug?: string | null;
    seo_title?: string | null;
    seo_description?: string | null;
    og_image?: string | null;
    favicon_url?: string | null;
    custom_css?: string | null;
    custom_head_html?: string | null;
    noindex?: boolean;
    meta_pixel_id?: string | null;
    ga4_id?: string | null;
    gtm_id?: string | null;
  };

  // 許可フィールドのみを更新（他のフィールドは無視）
  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  // slug: フォーマット検証 + 重複チェック
  if ("slug" in body) {
    const slug = body.slug;
    if (slug !== null && slug !== undefined && slug !== "") {
      if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
        return NextResponse.json(
          { error: "スラッグは小文字英数字とハイフンのみ使用できます（先頭・末尾はハイフン不可）" },
          { status: 400 },
        );
      }
      const { data: dup } = await admin
        .from("projects")
        .select("id")
        .eq("slug", slug)
        .neq("id", id)
        .maybeSingle();
      if (dup) {
        return NextResponse.json(
          { error: "このURLはすでに使用されています" },
          { status: 409 },
        );
      }
    }
    patch.slug = slug || null;
  }

  if ("seo_title"        in body) patch.seo_title        = body.seo_title        ?? null;
  if ("seo_description"  in body) patch.seo_description  = body.seo_description  ?? null;
  if ("og_image"         in body) patch.og_image         = body.og_image         ?? null;
  if ("favicon_url"      in body) patch.favicon_url      = body.favicon_url      ?? null;
  if ("custom_css"       in body) patch.custom_css       = body.custom_css       ?? null;
  if ("custom_head_html" in body) patch.custom_head_html = body.custom_head_html ?? null;
  if ("noindex"          in body) patch.noindex          = body.noindex          ?? false;
  if ("meta_pixel_id"    in body) patch.meta_pixel_id    = body.meta_pixel_id    ?? null;
  if ("ga4_id"           in body) patch.ga4_id           = body.ga4_id           ?? null;
  if ("gtm_id"           in body) patch.gtm_id           = body.gtm_id           ?? null;

  const { data, error } = await admin
    .from("projects")
    .update(patch)
    .eq("id", id)
    .select("id, slug, seo_title, seo_description, og_image, favicon_url, custom_css, custom_head_html, noindex, meta_pixel_id, ga4_id, gtm_id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
