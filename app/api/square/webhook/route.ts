import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase-admin";
import { getOrder, getCustomer, createSubscription, getFirstCardId } from "@/lib/square";
import { GRACE_PERIOD_DAYS, SQUARE_PRO_MONTHLY_PRICE } from "@/lib/plans";

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Square Webhook の HMAC-SHA256 署名を検証する。
 * Square は HMAC(key=signatureKey, msg=notificationUrl+rawBody) を Base64 エンコードして送信する。
 */
function verifySignature(
  rawBody: string,
  signature: string,
  notificationUrl: string,
): boolean {
  const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY ?? "";
  if (!key) return false;

  const expected = crypto
    .createHmac("sha256", key)
    .update(notificationUrl + rawBody)
    .digest("base64");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "base64"),
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}

// ─── Helper Types ─────────────────────────────────────────────────────────────

type AdminClient = ReturnType<typeof createAdminClient>;

// ─── Order Helper ─────────────────────────────────────────────────────────────

async function getUserIdFromOrderId(orderId: string): Promise<string | null> {
  try {
    const order = await getOrder(orderId);
    return order.reference_id ?? null;
  } catch (err) {
    console.error("[webhook] getOrder failed:", err);
    return null;
  }
}

// ─── billing_events 更新ヘルパー ──────────────────────────────────────────────

async function updateBillingEvent(
  admin: AdminClient,
  eventId: string,
  patch: { user_id?: string; billing_status?: string; amount?: number; currency?: string },
) {
  await admin.from("billing_events").update(patch).eq("square_event_id", eventId);
}

// ─── Pro 昇格（Trial → Pro） ──────────────────────────────────────────────────

/**
 * ユーザーを Pro に昇格させる。
 * - plan_type = 'pro'
 * - billing_status = 'active'
 * - current_period_end = now + 30 days
 * - plan_started_at = now（usage_reset_at も同時更新）
 */
async function upgradeToPro(
  admin: AdminClient,
  userId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("profiles").update({
    plan_type: "pro",
    billing_status: "active",
    current_period_end: periodEnd,
    plan_started_at: now,
    usage_reset_at: now,       // Trial 中の使用量をリセット
    grace_period_ends_at: null, // Grace Period をクリア
  }).eq("id", userId);

  if (error) {
    console.error("[webhook] upgradeToPro error:", error);
  } else {
    console.log(`[webhook] upgraded userId=${userId} to pro, period_end=${periodEnd}`);
  }
}

// ─── Event Handlers ───────────────────────────────────────────────────────────

/**
 * payment.created / payment.updated
 * - status=COMPLETED → Pro 昇格
 * - status=FAILED / CANCELED → Grace Period セット
 */
async function handlePaymentEvent(
  event: Record<string, unknown>,
  eventId: string,
  admin: AdminClient,
): Promise<void> {
  const data    = event.data as Record<string, unknown> | undefined;
  const obj     = data?.object as Record<string, unknown> | undefined;
  const payment = obj?.payment as Record<string, unknown> | undefined;

  if (!payment) return;

  const status     = payment.status as string | undefined;
  const orderId    = payment.order_id as string | undefined;
  const customerId = payment.customer_id as string | undefined;

  // カード ID（サブスク作成に必要）
  const cardDetails = payment.card_details as Record<string, unknown> | undefined;
  const card        = cardDetails?.card as Record<string, unknown> | undefined;
  const cardId      = card?.id as string | undefined;

  // 金額情報
  const amountMoney = payment.amount_money as Record<string, unknown> | undefined;
  const amount   = typeof amountMoney?.amount   === "number" ? amountMoney.amount   : undefined;
  const currency = typeof amountMoney?.currency === "string" ? amountMoney.currency : undefined;

  if (!orderId) {
    console.warn("[webhook] payment event missing order_id");
    return;
  }

  // order から userId と customer_id を両方取得
  let orderCustomerId: string | undefined;
  let userId: string | null = null;
  try {
    const order = await getOrder(orderId);
    userId = order.reference_id ?? null;
    orderCustomerId = order.customer_id;
  } catch (err) {
    console.error("[webhook] getOrder failed:", err);
    return;
  }

  if (!userId) {
    console.warn("[webhook] order has no reference_id, orderId:", orderId);
    return;
  }

  // ── 決済成功 ────────────────────────────────────────────────────────────────
  if (status === "COMPLETED") {
    await updateBillingEvent(admin, eventId, {
      user_id: userId,
      billing_status: "active",
      amount: amount ?? SQUARE_PRO_MONTHLY_PRICE,
      currency: currency ?? "JPY",
    });

    // Pro に昇格（即時アクセス付与）
    await upgradeToPro(admin, userId);

    // customer_id を profiles に保存（payment または order から取得）
    const resolvedCustomerId = customerId ?? orderCustomerId;
    if (resolvedCustomerId) {
      await admin.from("profiles")
        .update({ square_customer_id: resolvedCustomerId })
        .eq("id", userId);
    }

    // サブスクリプションを作成（翌月から自動更新）
    if (resolvedCustomerId) {
      try {
        // cardId が payment オブジェクトになければ Customer のカード一覧から取得
        const resolvedCardId = cardId ?? await getFirstCardId(resolvedCustomerId);
        if (!resolvedCardId) {
          console.warn("[webhook] cannot create subscription: no card found for customerId", resolvedCustomerId);
        } else {
          const nextMonth = new Date();
          nextMonth.setMonth(nextMonth.getMonth() + 1);
          const startDate = nextMonth.toISOString().slice(0, 10); // YYYY-MM-DD

          const { subscriptionId } = await createSubscription(resolvedCustomerId, resolvedCardId, startDate);
          await admin.from("profiles")
            .update({ square_subscription_id: subscriptionId })
            .eq("id", userId);
          console.log(`[webhook] subscription created: ${subscriptionId} for userId=${userId}`);
        }
      } catch (subErr) {
        // サブスク作成失敗は Pro 昇格を取り消さない（次回更新時に手動対応）
        console.error("[webhook] createSubscription failed:", subErr);
      }
    } else {
      console.warn("[webhook] cannot create subscription: missing customerId");
    }

    return;
  }

  // ── 決済失敗 / キャンセル → Grace Period ────────────────────────────────────
  if (status === "FAILED" || status === "CANCELED") {
    const gracePeriodEndsAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    await updateBillingEvent(admin, eventId, {
      user_id: userId,
      billing_status: "past_due",
    });

    const { error } = await admin.from("profiles").update({
      billing_status: "past_due",
      grace_period_ends_at: gracePeriodEndsAt,
      // plan_type は 'pro' のまま（Grace Period 内は利用継続）
    }).eq("id", userId);

    if (error) {
      console.error("[webhook] set past_due error:", error);
    } else {
      console.log(`[webhook] payment failed userId=${userId}, grace until ${gracePeriodEndsAt}`);
    }
  }
}

/**
 * subscription.created
 * - サブスクリプション新規作成時に customer_id / subscription_id を profiles に保存し Pro に昇格。
 * - customer.reference_id (= userId) を優先。取得できなければ email でユーザーを照合。
 */
async function handleSubscriptionCreated(
  event: Record<string, unknown>,
  admin: AdminClient,
): Promise<void> {
  const data = event.data as Record<string, unknown> | undefined;
  const obj  = data?.object as Record<string, unknown> | undefined;
  const sub  = obj?.subscription as Record<string, unknown> | undefined;

  if (!sub) return;

  const customerId = sub.customer_id as string | undefined;
  const subId      = sub.id as string | undefined;

  if (!customerId) {
    console.warn("[webhook] subscription.created: missing customer_id");
    return;
  }

  // Square Customer から reference_id (= userId) または email を取得
  let userId: string | null = null;
  try {
    const customer = await getCustomer(customerId);

    if (customer.reference_id) {
      // createCheckoutLink で埋め込んだ userId
      userId = customer.reference_id;
    } else if (customer.email_address) {
      // フォールバック: メールアドレスで profiles を検索
      const { data: profile } = await admin
        .from("profiles")
        .select("id")
        .eq("email", customer.email_address)
        .maybeSingle();
      userId = profile?.id ?? null;
    }
  } catch (err) {
    console.error("[webhook] getCustomer failed:", err);
    return;
  }

  if (!userId) {
    console.warn("[webhook] subscription.created: could not resolve userId from customer", customerId);
    return;
  }

  // customer_id / subscription_id を保存 + Pro 昇格
  const now = new Date().toISOString();
  const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await admin.from("profiles").update({
    plan_type: "pro",
    billing_status: "active",
    square_customer_id: customerId,
    square_subscription_id: subId,
    current_period_end: periodEnd,
    plan_started_at: now,
    usage_reset_at: now,
    grace_period_ends_at: null,
  }).eq("id", userId);

  if (error) {
    console.error("[webhook] subscription.created update error:", error);
  } else {
    console.log(`[webhook] subscription created userId=${userId} customerId=${customerId} subId=${subId}`);
  }
}

/**
 * subscription.updated
 * - status=ACTIVE → billing_status=active（回収成功・更新）
 * - status=PAUSED / DEACTIVATED → billing_status=past_due + Grace Period
 * - usage_reset_at を更新して月次使用量をリセット（更新成功時のみ）
 */
async function handleSubscriptionUpdated(
  event: Record<string, unknown>,
  admin: AdminClient,
): Promise<void> {
  const data = event.data as Record<string, unknown> | undefined;
  const obj  = data?.object as Record<string, unknown> | undefined;
  const sub  = obj?.subscription as Record<string, unknown> | undefined;

  if (!sub) return;

  const customerId = sub.customer_id as string | undefined;
  const subId      = sub.id as string | undefined;
  const subStatus  = sub.status as string | undefined;

  if (!customerId) return;

  if (subStatus === "ACTIVE") {
    // 更新成功 → active 復帰 + 使用量リセット
    const now = new Date().toISOString();
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const { error } = await admin.from("profiles").update({
      plan_type: "pro",
      billing_status: "active",
      square_subscription_id: subId,
      current_period_end: periodEnd,
      grace_period_ends_at: null,
      usage_reset_at: now,       // 月次使用量リセット
    }).eq("square_customer_id", customerId);

    if (error) {
      console.error("[webhook] subscription ACTIVE update error:", error);
    } else {
      console.log(`[webhook] subscription renewed customerId=${customerId}`);
    }
  } else {
    // 失敗・停止 → Grace Period
    const gracePeriodEndsAt = new Date(
      Date.now() + GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error } = await admin.from("profiles").update({
      billing_status: "past_due",
      square_subscription_id: subId,
      grace_period_ends_at: gracePeriodEndsAt,
    }).eq("square_customer_id", customerId);

    if (error) {
      console.error("[webhook] subscription past_due error:", error);
    } else {
      console.log(`[webhook] subscription ${subStatus} customerId=${customerId}, grace until ${gracePeriodEndsAt}`);
    }
  }
}

/**
 * subscription.deleted / subscription.canceled
 * - billing_status = 'canceled'
 * - plan_type は current_period_end まで 'pro' のまま（フロントで評価）
 */
async function handleSubscriptionCanceled(
  event: Record<string, unknown>,
  admin: AdminClient,
): Promise<void> {
  const data = event.data as Record<string, unknown> | undefined;
  const obj  = data?.object as Record<string, unknown> | undefined;
  const sub  = obj?.subscription as Record<string, unknown> | undefined;

  if (!sub) return;

  const customerId = sub.customer_id as string | undefined;
  if (!customerId) return;

  // current_period_end は既に profiles にセット済みの値を維持
  // plan_type は current_period_end まで 'pro' のまま（フロント側で expired 判定）
  const { error } = await admin.from("profiles").update({
    billing_status: "canceled",
    canceled_at: new Date().toISOString(),
  }).eq("square_customer_id", customerId);

  if (error) {
    console.error("[webhook] subscription canceled error:", error);
  } else {
    console.log(`[webhook] subscription canceled customerId=${customerId}`);
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Raw body を読み取る（署名検証 + JSON parse で使用）
  const rawBody = await req.text();

  // 2. 署名検証
  const signature      = req.headers.get("x-square-hmacsha256-signature") ?? "";
  const notificationUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/square/webhook`;

  if (!verifySignature(rawBody, signature, notificationUrl)) {
    console.warn("[webhook] invalid signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // 3. JSON パース
  let event: Record<string, unknown>;
  try {
    event = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventId   = event.event_id as string | undefined;
  const eventType = event.type     as string | undefined;

  if (!eventId || !eventType) {
    return NextResponse.json({ error: "Missing event_id or type" }, { status: 400 });
  }

  const admin = createAdminClient();

  // 4. 冪等性チェック（square_event_id の UNIQUE 制約で重複処理を防ぐ）
  const { error: insertError } = await admin.from("billing_events").insert({
    square_event_id: eventId,
    event_type: eventType,
    raw_payload: event,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // 重複イベント → 200 を返して Square のリトライを止める
      console.log(`[webhook] duplicate event ${eventId}, skipping`);
      return NextResponse.json({ ok: true });
    }
    console.error("[webhook] billing_events insert error:", insertError);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  // 5. イベントルーティング
  try {
    if (eventType === "payment.created" || eventType === "payment.updated") {
      await handlePaymentEvent(event, eventId, admin);
    } else if (eventType === "subscription.created") {
      await handleSubscriptionCreated(event, admin);
    } else if (eventType === "subscription.updated") {
      await handleSubscriptionUpdated(event, admin);
    } else if (
      eventType === "subscription.deleted" ||
      eventType === "subscription.canceled"
    ) {
      await handleSubscriptionCanceled(event, admin);
    } else {
      console.log(`[webhook] unhandled event type: ${eventType}`);
    }
  } catch (err) {
    // ハンドラーエラーは 200 を返してリトライを防ぐ
    // （Square は 2xx 以外を受け取るとリトライする）
    console.error(`[webhook] handler error for ${eventType}:`, err);
  }

  return NextResponse.json({ ok: true });
}
