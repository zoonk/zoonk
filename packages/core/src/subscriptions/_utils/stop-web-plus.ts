import "server-only";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { reportSubscriptionChange } from "@zoonk/auth/subscription-events";
import { prisma } from "@zoonk/db";
import { type PriceInfo } from "@zoonk/utils/currency";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { PLUS_PLAN } from "@zoonk/utils/subscription";
import type Stripe from "stripe";

/** More than a decade of monthly payments; an account below the minimum age can't have more. */
const MAX_REFUNDED_INVOICES = 200;

/** A renewal Stripe couldn't charge has no Plus left, but Stripe keeps trying to collect it. */
export const UNPAID_STATUSES = ["past_due", "unpaid"];

export function toDate(seconds: number): Date {
  return new Date(seconds * 1000);
}

export function isUnpaid(subscription: Stripe.Subscription): boolean {
  return UNPAID_STATUSES.includes(subscription.status);
}

export function getLatestInvoice(subscription: Stripe.Subscription): Stripe.Invoice | null {
  const invoice = subscription.latest_invoice;
  return invoice && typeof invoice !== "string" ? invoice : null;
}

/**
 * Refunds what's still owed of `owed`, so a payment refunded by hand or a request retried after a
 * failure never refunds twice; concurrent requests share Stripe's idempotency key.
 */
async function refundInvoice({ invoice, owed }: { invoice: Stripe.Invoice; owed: number }) {
  const payment = invoice.payments?.data.find((entry) => entry.status === "paid")?.payment;

  const paymentIntentId =
    typeof payment?.payment_intent === "string"
      ? payment.payment_intent
      : payment?.payment_intent?.id;

  if (!paymentIntentId) {
    throw new Error(`Invoice ${invoice.id} has no paid payment to refund`);
  }

  const paymentIntent = await stripeClient.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const charge = paymentIntent.latest_charge;
  const refunded = charge && typeof charge !== "string" ? charge.amount_refunded : 0;
  const amount = owed - refunded;

  if (amount <= 0) {
    return;
  }

  const refund = await stripeClient.refunds.create(
    { amount, payment_intent: paymentIntentId, reason: "requested_by_customer" },
    { idempotencyKey: `plus-refund-${invoice.id}-${refunded}` },
  );

  if (refund.status === "failed" || refund.status === "canceled") {
    throw new Error(`Refund ${refund.id} for invoice ${invoice.id} ${refund.status}`);
  }
}

export async function refundLatestPayment({
  owed,
  subscription,
}: {
  owed: number;
  subscription: Stripe.Subscription;
}): Promise<void> {
  const invoice = getLatestInvoice(subscription);

  if (!invoice) {
    throw new Error(`Subscription ${subscription.id} has no paid invoice to refund`);
  }

  await refundInvoice({ invoice, owed });
}

/** Returns what the customers paid in all. */
export async function refundEveryPayment(customerIds: string[]): Promise<PriceInfo | null> {
  const listed = await Promise.all(
    customerIds.map((customer) =>
      stripeClient.invoices
        .list({ customer, expand: ["data.payments"], status: "paid" })
        .autoPagingToArray({ limit: MAX_REFUNDED_INVOICES }),
    ),
  );

  const paid = listed.flat().filter((invoice) => invoice.amount_paid > 0);

  await Promise.all(paid.map((invoice) => refundInvoice({ invoice, owed: invoice.amount_paid })));

  const [first] = paid;

  return first
    ? {
        amount: paid.reduce((sum, invoice) => sum + invoice.amount_paid, 0),
        currency: first.currency,
      }
    : null;
}

/** A failure here leaves the invoice open but no longer collected, so it doesn't undo the cancel. */
async function voidOpenInvoice(subscription: Stripe.Subscription): Promise<void> {
  const invoice = getLatestInvoice(subscription);

  if (!invoice?.id || invoice.status !== "open") {
    return;
  }

  const { error } = await safeAsync(() => stripeClient.invoices.voidInvoice(invoice.id));

  if (error) {
    logError("Voiding an unpaid Plus invoice failed", { error, invoice: invoice.id });
  }
}

/** An extraordinary cancellation's reason goes to Stripe, where support sees it beside the subscription. */
export async function stopSubscription({
  endsAt,
  endsNow,
  reason,
  subscription,
}: {
  endsAt: Date;
  endsNow: boolean;
  reason: string | null;
  subscription: Stripe.Subscription;
}): Promise<Stripe.Subscription> {
  const cancelNow = {
    ...(reason && { cancellation_details: { comment: reason } }),
    prorate: false,
  };

  if (isUnpaid(subscription)) {
    const canceled = await stripeClient.subscriptions.cancel(subscription.id, cancelNow);
    await voidOpenInvoice(subscription);
    return canceled;
  }

  if (endsNow) {
    return stripeClient.subscriptions.cancel(subscription.id, cancelNow);
  }

  const item = subscription.items.data[0];

  // Ending before the period does would otherwise make Stripe credit the rest on its own.
  if (item && endsAt.getTime() < toDate(item.current_period_end).getTime()) {
    return stripeClient.subscriptions.update(subscription.id, {
      cancel_at: Math.floor(endsAt.getTime() / 1000),
      proration_behavior: "none",
    });
  }

  return stripeClient.subscriptions.update(subscription.id, { cancel_at_period_end: true });
}

/** Turns a stopped renewal back on, clearing whichever field Stripe keeps the end in. */
export function resumeSubscription(
  subscription: Stripe.Subscription,
): Promise<Stripe.Subscription> {
  return stripeClient.subscriptions.update(
    subscription.id,
    subscription.cancel_at ? { cancel_at: "" } : { cancel_at_period_end: false },
  );
}

/**
 * Stripe's webhook later writes the same fields; writing them now keeps the app and the API from
 * showing the old plan meanwhile.
 */
export async function saveSubscription({
  subscription,
  userId,
}: {
  subscription: Stripe.Subscription;
  userId: string;
}): Promise<void> {
  const item = subscription.items.data[0];

  await prisma.subscription.updateMany({
    data: {
      cancelAt: subscription.cancel_at ? toDate(subscription.cancel_at) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at ? toDate(subscription.canceled_at) : null,
      endedAt: subscription.ended_at ? toDate(subscription.ended_at) : null,
      ...(item && {
        periodEnd: toDate(item.current_period_end),
        periodStart: toDate(item.current_period_start),
      }),
      status: subscription.status,
    },
    where: { provider: "stripe", referenceId: userId, stripeSubscriptionId: subscription.id },
  });
}

/**
 * The webhook then sees the cancel as already recorded, so a stopped renewal reports its analytics
 * here.
 */
export async function saveStoppedSubscription({
  stopped,
  userId,
}: {
  stopped: Stripe.Subscription;
  userId: string;
}): Promise<void> {
  await saveSubscription({ subscription: stopped, userId });

  if (stopped.status === "active") {
    await reportSubscriptionChange({
      change: "canceled",
      plan: PLUS_PLAN.name,
      referenceId: userId,
    });
  }
}
