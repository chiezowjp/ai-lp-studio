import { createClient } from "@supabase/supabase-js";

/**
 * サーバー (API Routes) 専用の管理クライアント。
 * SUPABASE_SERVICE_ROLE_KEY を使うため、クライアント側には絶対に渡さないこと。
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/**
 * Authorization: Bearer <token> ヘッダーからユーザーを取得。
 * 無効な場合は null を返す。
 */
export async function getUserFromRequest(req: Request) {
  const auth  = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const admin = createAdminClient();
  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}
