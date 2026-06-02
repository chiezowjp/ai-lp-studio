/**
 * PayPal の商品（Product）と請求プラン（Plan）を作成するスクリプト。
 * 一度だけ実行して PAYPAL_PLAN_ID を取得し .env.local / Railway に設定する。
 *
 * 実行: node scripts/setup-paypal-plan.mjs
 */

import { readFileSync } from "fs";

const env = readFileSync(".env.local", "utf-8");
const clientId = env.match(/^PAYPAL_CLIENT_ID=(.+)/m)?.[1]?.trim();
const secret   = env.match(/^PAYPAL_CLIENT_SECRET=(.+)/m)?.[1]?.trim();
const paypalEnv = env.match(/^PAYPAL_ENV=(.+)/m)?.[1]?.trim() ?? "production";

const BASE_URL = paypalEnv === "production"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";

console.log(`環境: ${paypalEnv} (${BASE_URL})`);

async function getToken() {
  const res = await fetch(`${BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const json = await res.json();
  if (!res.ok) { console.error("Auth failed:", json); process.exit(1); }
  return json.access_token;
}

async function req(method, path, body) {
  const token = await getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const json = await res.json();
  if (!res.ok) { console.error(`${method} ${path} failed:`, JSON.stringify(json, null, 2)); process.exit(1); }
  return json;
}

// 1. 商品を作成
const product = await req("POST", "/v1/catalogs/products", {
  name: "AI LP STUDIO Pro プラン",
  description: "AI LP STUDIO Pro プラン 月額サブスクリプション",
  type: "SERVICE",
  category: "SOFTWARE",
});
console.log("✅ Product created:", product.id);

// 2. 請求プランを作成
const plan = await req("POST", "/v1/billing/plans", {
  product_id: product.id,
  name: "AI LP STUDIO Pro 月額プラン",
  description: "月額 ¥2,980（税込）",
  status: "ACTIVE",
  billing_cycles: [
    {
      frequency: { interval_unit: "MONTH", interval_count: 1 },
      tenure_type: "REGULAR",
      sequence: 1,
      total_cycles: 0,
      pricing_scheme: {
        fixed_price: { value: "2980", currency_code: "JPY" },
      },
    },
  ],
  payment_preferences: {
    auto_bill_outstanding: true,
    setup_fee: { value: "0", currency_code: "JPY" },
    setup_fee_failure_action: "CONTINUE",
    payment_failure_threshold: 3,
  },
});
console.log("✅ Plan created:", plan.id);
console.log("\n========================================");
console.log("以下を .env.local と Railway に追加してください:");
console.log(`PAYPAL_PLAN_ID=${plan.id}`);
console.log("========================================");
