import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, getUserFromRequest } from "@/lib/supabase-admin";
import { titleToSlug } from "@/lib/slug";
import { PLAN_LIMITS } from "@/lib/plans";
import { requirePlanGuard } from "@/lib/plan-guard";
import { logAudit } from "@/lib/audit-logger";

type RouteCtx = { params: Promise<{ id: string }> };

/**
 * POST /api/projects/[id]/publish
 * LP の公開 / 非公開を切り替える。
 *
 * body: { action: "publish" | "unpublish" }
 *
 * 公開時:
 *   - slug が未設定なら title から自動生成（重複回避）
 *   - is_published = true, published_at = now()
 *   - Pro プランのみ許可
 *
 * 非公開時:
 *   - is_published = false
 *   - slug はそのまま保持（再公開時に同じ URL を使える）
 */
export async function POST(req: NextRequest, ctx: RouteCtx) {
  // ── サーバーサイド プラン・課金ガード（Pro 限定） ──
  const guard = await requirePlanGuard(req, { requirePro: true });
  if (guard instanceof NextResponse) return guard;
  const { user } = guard;

  const { id } = await ctx.params;
  const body = await req.json() as { action?: string; css?: string };
  const action = body.action;

  if (action !== "publish" && action !== "unpublish") {
    return NextResponse.json({ error: "action must be 'publish' or 'unpublish'" }, { status: 400 });
  }

  const admin = createAdminClient();

  // プロジェクト取得 + 所有者確認（Phase 8: html / css / project_json も取得）
  const { data: project, error: fetchErr } = await admin
    .from("projects")
    .select("id, user_id, title, slug, is_published, html, css, project_json")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !project) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (project.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (action === "publish") {
    // requirePro: true で既にチェック済み — 二重チェックでさらに確実に
    const planType = guard.planType;
    if (!PLAN_LIMITS[planType].canPublish) {
      return NextResponse.json(
        { error: "LP公開はProプランで利用できます", code: "PLAN_LIMIT" },
        { status: 403 },
      );
    }

    // slug 生成（未設定の場合）
    let slug = project.slug as string | null;
    if (!slug) {
      const base = titleToSlug(project.title as string);
      // 重複チェック（シンプル版 — ensureUniqueSlug の型制約を避けるため直接実装）
      slug = base;
      let suffix = 2;
      for (let i = 0; i < 20; i++) {
        const { data: existing } = await admin
          .from("projects")
          .select("id")
          .eq("slug", slug)
          .neq("id", id)
          .maybeSingle();
        if (!existing) break;
        slug = `${base}-${suffix}`;
        suffix++;
      }
    }

    const nowIso = new Date().toISOString();

    // Phase 8: publish 前に version スナップショットを保存
    admin.from("versions").insert({
      project_id:    id,
      user_id:       user.id,
      snapshot_json: {
        html:         project.html,
        css:          project.css,
        project_json: project.project_json,
        title:        project.title,
      },
      trigger: "publish",
      note:    `公開（${nowIso.slice(0, 10)}）`,
    }).then(({ error: vErr }) => {
      if (vErr) console.error("[publish] version snapshot error:", vErr.message);
    });

    const { data, error } = await admin
      .from("projects")
      .update({
        is_published:      true,
        published_at:      nowIso,
        last_published_at: nowIso,
        slug,
        // Phase 8: draft を published にコピー
        // body.css が存在する場合はクライアントの effectiveCss（画像・ビジュアルスタイル含む）を優先
        published_html:    project.html,
        published_css:     body.css ?? project.css,
        updated_at:        nowIso,
      })
      .eq("id", id)
      .select("id, slug, is_published, published_at, seo_title, seo_description, og_image, favicon_url, noindex")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // 監査ログ
    logAudit({ userId: user.id, action: "publish", targetType: "project", targetId: id, metadata: { slug: data.slug }, req });

    return NextResponse.json(data);
  }

  // unpublish
  const { data, error } = await admin
    .from("projects")
    .update({
      is_published: false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, slug, is_published, published_at, seo_title, seo_description, og_image, favicon_url, noindex")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // 監査ログ
  logAudit({ userId: user.id, action: "unpublish", targetType: "project", targetId: id, req });

  return NextResponse.json(data);
}

/**
 * GET /api/projects/[id]/publish
 * 現在の公開設定を取得する（PublishPanel の初期値読み込み用）。
 */
export async function GET(req: NextRequest, ctx: RouteCtx) {
  const user = await getUserFromRequest(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("projects")
    .select("id, user_id, slug, is_published, published_at, seo_title, seo_description, og_image, favicon_url, custom_css, custom_head_html, noindex, meta_pixel_id, ga4_id, gtm_id")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (data.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  return NextResponse.json(data);
}
