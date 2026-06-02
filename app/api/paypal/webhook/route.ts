import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { verifyWebhookSignature } from "@/lib/paypal";
import { GRACE_PERIOD_DAYS } from "@/lib/plans";

type AdminClient = ReturnType<typeof createAdminClient>;

async function upgradeToPro(admin: AdminClient, userId: string): Promise<void> {
  const now       = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("profiles").update({
    plan_type:            "pro",
    billing_status:       "active",
    current_period_end:   periodEnd,
    plan_started_at:      now,
    usage_reset_at:       now,
    grace_period_ends_at: null,
  }).eq("id", userId);

  if (error) console.error("[paypal webhook] upgradeToPro error:", error);
  else console.log(`[paypal webhook] upgraded userId=${userId} to pro, period_end=${periodEnd}`);
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  // 署名検証
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => { headers[key] = value; });

  const valid = await verifyWebhookSignature(headers, rawBody);
  if (!valid) {
    console.warn("[paypal webhook] invalid signature");
    // PayPal は 200 以外でリトライするため、検証失敗でも 200 を返す
    return NextResponse.json({ ok: true });
  }

  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.event_type as string | undefined;
  const resource  = event.resource  as Record<string, unknown> | undefined;

  if (!eventType || !resource) return NextResponse.json({ ok: true });

  const admin = createAdminClient();

  try {
    // ── サブスクリプション有効化（初回申し込み完了）────────────────────────
    if (eventType === "BILLING.SUBSCRIPTION.ACTIVATED") {
      const subscriptionId = resource.id        as string | undefined;
      const userId         = resource.custom_id as string | undefined;

      if (!subscriptionId || !userId) {
        console.warn("[paypal webhook] ACTIVATED: missing id or custom_id");
        return NextResponse.json({ ok: true });
      }

      // subscription_id を保存してから Pro に昇格
      await admin.from("profiles")
        .update({ square_subscription_id: subscriptionId })
        .eq("id", userId);

      await upgradeToPro(admin, userId);
      console.log(`[paypal webhook] subscription activated: ${subscriptionId} for userId=${userId}`);
    }

    // ── 月次決済成功（自動更新）──────────────────────────────────────────
    else if (eventType === "PAYMENT.SALE.COMPLETED") {
      const subscriptionId = resource.billing_agreement_id as string | undefined;
      if (!subscriptionId) return NextResponse.json({ ok: true });

      const now       = new Date().toISOString();
      const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const { error } = await admin.from("profiles").update({
        plan_type:            "pro",
        billing_status:       "active",
        current_period_end:   periodEnd,
        grace_period_ends_at: null,
        usage_reset_at:       now,
      }).eq("square_subscription_id", subscriptionId);

      if (error) console.error("[paypal webhook] PAYMENT.SALE.COMPLETED error:", error);
      else console.log(`[paypal webhook] subscription renewed: ${subscriptionId}`);
    }

    // ── キャンセル ────────────────────────────────────────────────────────
    else if (eventType === "BILLING.SUBSCRIPTION.CANCELLED") {
      const subscriptionId = resource.id as string | undefined;
      if (!subscriptionId) return NextResponse.json({ ok: true });

      const { error } = await admin.from("profiles").update({
        billing_status: "canceled",
        canceled_at:    new Date().toISOString(),
      }).eq("square_subscription_id", subscriptionId);

      if (error) console.error("[paypal webhook] CANCELLED error:", error);
      else console.log(`[paypal webhook] subscription cancelled: ${subscriptionId}`);
    }

    // ── 停止（支払い失敗）→ Grace Period ──────────────────────────────────
    else if (eventType === "BILLING.SUBSCRIPTION.SUSPENDED") {
      const subscriptionId = resource.id as string | undefined;
      if (!subscriptionId) return NextResponse.json({ ok: true });

      const gracePeriodEndsAt = new Date(
        Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
      ).toISOString();

      const { error } = await admin.from("profiles").update({
        billing_status:       "past_due",
        grace_period_ends_at: gracePeriodEndsAt,
      }).eq("square_subscription_id", subscriptionId);

      if (error) console.error("[paypal webhook] SUSPENDED error:", error);
      else console.log(`[paypal webhook] subscription suspended: ${subscriptionId}`);
    }

    else {
      console.log(`[paypal webhook] unhandled event type: ${eventType}`);
    }
  } catch (err) {
    console.error(`[paypal webhook] handler error for ${eventType}:`, err);
  }

  return NextResponse.json({ ok: true });
}
