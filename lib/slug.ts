/**
 * slug ユーティリティ
 *
 * タイトル文字列から URL スラッグを生成する。
 * - ASCII 文字が含まれる場合はそれをベースに生成
 * - 日本語のみ（ASCII が少ない）場合は lp-{random} を返す
 * - 最大 60 文字
 */

/** ランダムな英数字 ID を生成（デフォルト 8 文字） */
function randomId(len = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * タイトルをスラッグに変換する。
 *
 * 例:
 *   "Radio Wave Salon"   → "radio-wave-salon"
 *   "ラジオ波温熱サロン"  → "lp-a3f8b2c1"
 *   "AI LP Studio 2024"  → "ai-lp-studio-2024"
 */
export function titleToSlug(title: string): string {
  // 非 ASCII 文字をスペースに置換してから slug 化
  const ascii = title
    .toLowerCase()
    .replace(/[^\x00-\x7F]/g, " ")   // 日本語 → スペース
    .trim()
    .replace(/\s+/g, "-")             // 空白 → ハイフン
    .replace(/[^a-z0-9-]/g, "")      // 英数字とハイフン以外を除去
    .replace(/-+/g, "-")             // 連続ハイフンを1つに
    .replace(/^-|-$/g, "")           // 先頭・末尾のハイフンを除去
    .slice(0, 60);

  // ASCII 部分が 3 文字以上あれば使用
  if (ascii.length >= 3) {
    return ascii;
  }

  // 日本語のみのタイトルなどは lp-{random}
  return `lp-${randomId()}`;
}

/**
 * Supabase admin クライアントを使ってスラッグの重複を回避し、
 * ユニークなスラッグを返す。
 *
 * 例: "radio-wave-salon" が使用済みなら "radio-wave-salon-2" を試す
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  admin: {
    from: (table: string) => {
      select: (col: string) => {
        eq: (col: string, val: string) => {
          neq?: (col: string, val: string) => { maybeSingle: () => Promise<{ data: unknown }> };
          maybeSingle: () => Promise<{ data: unknown }>;
        };
      };
    };
  },
  excludeId?: string,
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  // 最大 20 回試行（無限ループ防止）
  for (let i = 0; i < 20; i++) {
    const query = admin.from("projects").select("id").eq("slug", slug);
    // excludeId は TypeScript 型の都合でここでは直接使えないため、
    // 結果の id と比較する形で重複チェック
    const { data } = await (query as { maybeSingle: () => Promise<{ data: { id?: string } | null }> }).maybeSingle();

    if (!data || (excludeId && (data as { id?: string }).id === excludeId)) {
      // 空 or 自分自身のみ → 使用可能
      return slug;
    }

    slug = `${baseSlug}-${suffix}`;
    suffix++;
  }

  // フォールバック: ランダムサフィックス
  return `${baseSlug}-${randomId(6)}`;
}
