/**
 * Square API ヘルパー
 *
 * SQUARE_ENV=sandbox (デフォルト) → Sandbox 環境
 * SQUARE_ENV=production           → 本番環境
 *
 * 必要な環境変数:
 *   SQUARE_ACCESS_TOKEN           — Square アクセストークン
 *   SQUARE_LOCATION_ID            — Square ロケーション ID
 *   SQUARE_WEBHOOK_SIGNATURE_KEY  — Webhook 署名キー
 *   NEXT_PUBLIC_APP_URL           — アプリの公開 URL（リダイレクト先）
 */

const IS_PRODUCTION = process.env.SQUARE_ENV === "production";

const BASE_URL = IS_PRODUCTION
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

/** Square API バージョン */
const SQUARE_VERSION = "2024-07-17";

// ─── 共通ヘッダー ──────────────────────────────────────────────────────────────

function squareHeaders(): Record<string, string> {
  return {
    "Square-Version": SQUARE_VERSION,
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN ?? ""}`,
  };
}

// ─── Fetch ラッパー ────────────────────────────────────────────────────────────

export async function squareFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...squareHeaders(),
      ...(options.headers as Record<string, string> | undefined ?? {}),
    },
  });

  const json = (await res.json()) as Record<string, unknown>;

  if (!res.ok) {
    const errors = json.errors as Array<{ detail?: string }> | undefined;
    const msg = errors?.[0]?.detail ?? `Square API error (${res.status})`;
    throw new Error(msg);
  }

  return json as T;
}

// ─── Payment Link 作成 ────────────────────────────────────────────────────────

interface CreatePaymentLinkResponse {
  payment_link: {
    id: string;
    url: string;
    order_id: string;
  };
}

/**
 * Square Payment Link を作成して URL を返す。
 * order.reference_id に Supabase user.id をセットすることで
 * Webhook ハンドラーでユーザーを特定できるようにする。
 */
export async function createCheckoutLink(userId: string): Promise<string> {
  // 同一ユーザーが短期間に複数リクエストしても安全なよう、
  // タイムスタンプを含めた冪等キーを使用する
  const idempotencyKey = `checkout-${userId}-${Date.now()}`;

  const data = await squareFetch<CreatePaymentLinkResponse>(
    "/v2/online-checkout/payment-links",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        order: {
          location_id: process.env.SQUARE_LOCATION_ID,
          reference_id: userId,
          line_items: [
            {
              name: "AI LP STUDIO Pro プラン",
              quantity: "1",
              item_type: "ITEM",
              base_price_money: {
                amount: 2980,
                currency: "JPY",
              },
            },
          ],
        },
        checkout_options: {
          redirect_url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/billing/success`,
          ask_for_shipping_address: false,
        },
      }),
    },
  );

  return data.payment_link.url;
}

// ─── Order 取得 ───────────────────────────────────────────────────────────────

interface GetOrderResponse {
  order: {
    id: string;
    reference_id?: string;
    state?: string;
  };
}

/**
 * Square Order を取得する。
 * Webhook イベントの payment.order_id から reference_id (= userId) を取得するために使用する。
 */
export async function getOrder(orderId: string): Promise<{ reference_id?: string; state?: string }> {
  const data = await squareFetch<GetOrderResponse>(`/v2/orders/${orderId}`);
  return {
    reference_id: data.order.reference_id,
    state: data.order.state,
  };
}
