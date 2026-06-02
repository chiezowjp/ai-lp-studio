/**
 * Square API ヘルパー
 *
 * SQUARE_ENV=sandbox (デフォルト) → Sandbox 環境
 * SQUARE_ENV=production           → 本番環境
 *
 * 必要な環境変数:
 *   SQUARE_ACCESS_TOKEN                    — Square アクセストークン
 *   SQUARE_LOCATION_ID                     — Square ロケーション ID
 *   SQUARE_WEBHOOK_SIGNATURE_KEY           — Webhook 署名キー
 *   SQUARE_SUBSCRIPTION_PLAN_VARIATION_ID  — サブスクリプションプランバリエーション ID
 *   NEXT_PUBLIC_APP_URL                    — アプリの公開 URL（リダイレクト先）
 */

const IS_PRODUCTION = process.env.SQUARE_ENV === "production";

const BASE_URL = IS_PRODUCTION
  ? "https://connect.squareup.com"
  : "https://connect.squareupsandbox.com";

/** Square API バージョン */
const SQUARE_VERSION = "2024-07-17";

// ─── 共通ヘッダー ──────────────────────────────────────────────────────────────

function squareHeaders(): Record<string, string> {
  const token = IS_PRODUCTION
    ? process.env.SQUARE_ACCESS_TOKEN
    : (process.env.SQUARE_SANDBOX_ACCESS_TOKEN ?? process.env.SQUARE_ACCESS_TOKEN);
  return {
    "Square-Version": SQUARE_VERSION,
    "Content-Type": "application/json",
    Authorization: `Bearer ${token ?? ""}`,
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

// ─── サブスクリプション Payment Link 作成 ─────────────────────────────────────

interface CreatePaymentLinkResponse {
  payment_link: {
    id: string;
    url: string;
    order_id: string;
  };
}

/**
 * Square サブスクリプション Payment Link を作成して URL を返す。
 *
 * SQUARE_SUBSCRIPTION_PLAN_VARIATION_ID に設定したプランバリエーション ID を使用。
 * 購入者がチェックアウトを完了すると Square が自動的にサブスクリプションを作成し、
 * subscription.created / payment.created Webhook が発火する。
 *
 * ユーザー識別:
 *   subscription.created → customer_id → Square Customer の reference_id = userId
 *   （createCheckoutLink 実行時に Square Customer を事前作成して reference_id を埋め込む）
 */
export async function createCheckoutLink(userId: string): Promise<string> {
  const idempotencyKey = `checkout-${userId}-${Date.now()}`;

  const locationId = IS_PRODUCTION
    ? process.env.SQUARE_LOCATION_ID
    : process.env.SQUARE_SANDBOX_LOCATION_ID;

  // order.reference_id に userId を埋め込む。
  // payment.created Webhook で order を取得し userId を特定するために使用する。
  // 決済完了後、Webhook 側で Subscriptions API を呼び出してサブスクを作成する。
  const data = await squareFetch<CreatePaymentLinkResponse>(
    "/v2/online-checkout/payment-links",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        order: {
          location_id: locationId,
          reference_id: userId,
          line_items: [
            {
              name: "AI LP STUDIO Pro プラン（月額）",
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
    customer_id?: string;
  };
}

/**
 * Square Order を取得する。
 * Webhook イベントの payment.order_id から reference_id (= userId) を取得するために使用する。
 */
export async function getOrder(orderId: string): Promise<{ reference_id?: string; state?: string; customer_id?: string }> {
  const data = await squareFetch<GetOrderResponse>(`/v2/orders/${orderId}`);
  return {
    reference_id: data.order.reference_id,
    state: data.order.state,
    customer_id: data.order.customer_id,
  };
}

// ─── Customer 取得 ────────────────────────────────────────────────────────────

interface GetCustomerResponse {
  customer: {
    id: string;
    reference_id?: string;
    email_address?: string;
  };
}

/**
 * Square Customer を取得する。
 * subscription.created Webhook で customer_id → reference_id (= userId) を取得するために使用する。
 */
export async function getCustomer(customerId: string): Promise<{ reference_id?: string; email_address?: string }> {
  const data = await squareFetch<GetCustomerResponse>(`/v2/customers/${customerId}`);
  return {
    reference_id: data.customer.reference_id,
    email_address: data.customer.email_address,
  };
}

// ─── Customer のカード一覧取得 ─────────────────────────────────────────────────

interface ListCardsResponse {
  cards?: Array<{ id: string; card_brand?: string; last_4?: string }>;
}

/**
 * Square Customer に紐づくカード一覧を取得し、最初のカード ID を返す。
 */
export async function getFirstCardId(customerId: string): Promise<string | null> {
  try {
    const data = await squareFetch<ListCardsResponse>(
      `/v2/cards?customer_id=${customerId}`,
    );
    return data.cards?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

// ─── 決済からカードオンファイルを作成 ─────────────────────────────────────────

/**
 * 決済 ID を使って Customer にカードオンファイルを作成する。
 * Payment Link チェックアウトではカードが自動保存されないため、
 * payment.created webhook の payment.id から明示的にカードを保存する。
 */
export async function createCardOnFile(
  customerId: string,
  paymentId: string,
): Promise<string | null> {
  try {
    const idempotencyKey = `cof-${Date.now()}`;
    const data = await squareFetch<{ card: { id: string } }>(
      "/v2/cards",
      {
        method: "POST",
        body: JSON.stringify({
          idempotency_key: idempotencyKey,
          source_id: paymentId,
          card: {
            customer_id: customerId,
          },
        }),
      },
    );
    return data.card.id;
  } catch (err) {
    console.error("[square] createCardOnFile failed:", err);
    return null;
  }
}

// ─── サブスクリプション作成 ───────────────────────────────────────────────────

/**
 * Square Subscriptions API でサブスクリプションを作成する。
 * payment.created で初回決済が完了した後に呼び出し、月次自動更新を設定する。
 *
 * @param customerId  Square の customer_id
 * @param cardId      決済に使われたカード ID（card_details.card.id）
 * @param startDate   サブスク開始日（YYYY-MM-DD）— 二重請求を避けるため翌月初を推奨
 */
export async function createSubscription(
  customerId: string,
  cardId: string,
  startDate: string,
): Promise<{ subscriptionId: string }> {
  const planVariationId = IS_PRODUCTION
    ? process.env.SQUARE_SUBSCRIPTION_PLAN_VARIATION_ID
    : process.env.SQUARE_SANDBOX_PLAN_VARIATION_ID;

  const locationId = IS_PRODUCTION
    ? process.env.SQUARE_LOCATION_ID
    : process.env.SQUARE_SANDBOX_LOCATION_ID;

  if (!planVariationId || !locationId) {
    throw new Error("SQUARE_SUBSCRIPTION_PLAN_VARIATION_ID または SQUARE_LOCATION_ID が未設定");
  }

  const idempotencyKey = `sub-${customerId}-${Date.now()}`;

  const data = await squareFetch<{ subscription: { id: string } }>(
    "/v2/subscriptions",
    {
      method: "POST",
      body: JSON.stringify({
        idempotency_key: idempotencyKey,
        location_id: locationId,
        plan_variation_id: planVariationId,
        customer_id: customerId,
        card_id: cardId,
        start_date: startDate,
        phases: [{ ordinal: 0 }],
      }),
    },
  );

  return { subscriptionId: data.subscription.id };
}

// ─── サブスクリプションキャンセル ─────────────────────────────────────────────

/**
 * Square サブスクリプションをキャンセルする。
 * キャンセル後も current billing period の終了まで有効。
 */
export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await squareFetch(`/v2/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
  });
}
