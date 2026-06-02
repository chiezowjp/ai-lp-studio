/**
 * PayPal Subscriptions API ヘルパー
 *
 * PAYPAL_ENV=production → 本番環境
 * PAYPAL_ENV=sandbox    → サンドボックス環境
 *
 * 必要な環境変数:
 *   PAYPAL_CLIENT_ID      — PayPal Client ID
 *   PAYPAL_CLIENT_SECRET  — PayPal Client Secret
 *   PAYPAL_PLAN_ID        — 月額サブスクリプションプラン ID
 *   PAYPAL_WEBHOOK_ID     — Webhook ID（署名検証用）
 *   NEXT_PUBLIC_APP_URL   — アプリの公開 URL
 */

const IS_PRODUCTION = process.env.PAYPAL_ENV === "production";

const BASE_URL = IS_PRODUCTION
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

// ─── OAuth2 アクセストークン取得 ───────────────────────────────────────────────

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID ?? "";
  const secret   = process.env.PAYPAL_CLIENT_SECRET ?? "";

  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  const json = await res.json() as { access_token?: string; error_description?: string };
  if (!res.ok) throw new Error(json.error_description ?? `PayPal auth error (${res.status})`);
  return json.access_token ?? "";
}

// ─── Fetch ラッパー ────────────────────────────────────────────────────────────

async function paypalFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers as Record<string, string> | undefined ?? {}),
    },
  });

  if (res.status === 204) return {} as T;

  const json = await res.json() as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.message as string | undefined) ?? `PayPal API error (${res.status})`;
    throw new Error(msg);
  }
  return json as T;
}

// ─── サブスクリプション作成 ───────────────────────────────────────────────────

/**
 * PayPal サブスクリプションを作成して承認 URL を返す。
 * custom_id に userId を埋め込み、Webhook でユーザーを特定する。
 */
export async function createSubscription(
  userId: string,
): Promise<{ subscriptionId: string; approvalUrl: string }> {
  const planId    = process.env.PAYPAL_PLAN_ID ?? "";
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/billing/success`;
  const cancelUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/pricing`;

  const data = await paypalFetch<{
    id: string;
    links: Array<{ href: string; rel: string; method: string }>;
  }>("/v1/billing/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      plan_id: planId,
      custom_id: userId,
      application_context: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
        user_action: "SUBSCRIBE_NOW",
        payment_method: {
          payer_selected: "PAYPAL",
          payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED",
        },
      },
    }),
  });

  const approvalUrl = data.links.find((l) => l.rel === "approve")?.href;
  if (!approvalUrl) throw new Error("PayPal approval URL not found");

  return { subscriptionId: data.id, approvalUrl };
}

// ─── サブスクリプション取得 ───────────────────────────────────────────────────

export async function getSubscription(subscriptionId: string): Promise<{
  id: string;
  status: string;
  custom_id?: string;
}> {
  return paypalFetch(`/v1/billing/subscriptions/${subscriptionId}`);
}

// ─── サブスクリプションキャンセル ─────────────────────────────────────────────

export async function cancelSubscription(subscriptionId: string): Promise<void> {
  await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason: "Customer requested cancellation" }),
  });
}

// ─── Webhook 署名検証 ─────────────────────────────────────────────────────────

export async function verifyWebhookSignature(
  headers: Record<string, string>,
  body: string,
): Promise<boolean> {
  try {
    const result = await paypalFetch<{ verification_status: string }>(
      "/v1/notifications/verify-webhook-signature",
      {
        method: "POST",
        body: JSON.stringify({
          auth_algo:        headers["paypal-auth-algo"],
          cert_url:         headers["paypal-cert-url"],
          transmission_id:  headers["paypal-transmission-id"],
          transmission_sig: headers["paypal-transmission-sig"],
          transmission_time: headers["paypal-transmission-time"],
          webhook_id:       process.env.PAYPAL_WEBHOOK_ID ?? "",
          webhook_event:    JSON.parse(body) as Record<string, unknown>,
        }),
      },
    );
    return result.verification_status === "SUCCESS";
  } catch {
    return false;
  }
}
