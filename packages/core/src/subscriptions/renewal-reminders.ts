import "server-only";
import { sendPlusRenewalReminderEmail } from "@zoonk/auth/plus-emails";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { readSubscriptionMetadata } from "@zoonk/auth/stripe-subscription-metadata";
import { prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { toDate } from "./_utils/stop-web-plus";
import type Stripe from "stripe";

/**
 * California asks for 15 to 45 days before a yearly renewal, and France for more than a month
 * before the last day to cancel, which is the day before it.
 */
const EARLIEST_DAYS = 45;
const LATEST_DAYS = 32;

function getWindow(now: Date) {
  return {
    from: new Date(now.getTime() + LATEST_DAYS * MS_PER_DAY),
    to: new Date(now.getTime() + EARLIEST_DAYS * MS_PER_DAY),
  };
}

/**
 * Website subscriptions renewing within the window whose reminder hasn't gone out for this renewal.
 * Only a yearly period ends that far ahead.
 */
export async function listDueRenewalReminders(): Promise<string[]> {
  const now = new Date();
  const { from, to } = getWindow(now);

  const subscriptions = await prisma.subscription.findMany({
    select: { id: true },
    where: {
      OR: [{ renewalReminderSentFor: null }, { renewalReminderSentFor: { lt: now } }],
      cancelAt: null,
      cancelAtPeriodEnd: false,
      periodEnd: { gte: from, lte: to },
      provider: "stripe",
      status: "active",
      stripeSubscriptionId: { not: null },
    },
  });

  return subscriptions.map(({ id }) => id);
}

/** Stripe's copy decides, since ours trails its webhooks. */
function findRenewalDate({ now, subscription }: { now: Date; subscription: Stripe.Subscription }) {
  const item = subscription.items.data[0];
  const renewsAt = item && toDate(item.current_period_end);
  const { from, to } = getWindow(now);

  const renews =
    subscription.status === "active" &&
    !subscription.cancel_at_period_end &&
    !subscription.cancel_at &&
    item?.price.recurring?.interval === "year";

  return renews && renewsAt && renewsAt >= from && renewsAt <= to ? renewsAt : null;
}

/**
 * Emails one subscription's yearly renewal reminder with the price Stripe will charge, then records
 * the renewal it announced. Throws when the email fails, so a retry sends it. False when there's
 * nothing to send.
 */
export async function sendRenewalReminder(subscriptionId: string): Promise<boolean> {
  const now = new Date();

  const saved = await prisma.subscription.findUnique({
    select: { referenceId: true, renewalReminderSentFor: true, stripeSubscriptionId: true },
    where: { id: subscriptionId },
  });

  if (!saved?.stripeSubscriptionId) {
    return false;
  }

  const [subscription, user] = await Promise.all([
    stripeClient.subscriptions.retrieve(saved.stripeSubscriptionId),
    prisma.user.findUnique({ select: { email: true }, where: { id: saved.referenceId } }),
  ]);

  const renewsAt = findRenewalDate({ now, subscription });

  if (!user || !renewsAt || saved.renewalReminderSentFor?.getTime() === renewsAt.getTime()) {
    return false;
  }

  const renewal = await stripeClient.invoices.createPreview({ subscription: subscription.id });

  await sendPlusRenewalReminderEmail({
    ...readSubscriptionMetadata(subscription.metadata),
    email: user.email,
    renewal: { amount: renewal.amount_due, currency: renewal.currency, date: renewsAt },
  });

  await prisma.subscription.update({
    data: { renewalReminderSentFor: renewsAt },
    where: { id: subscriptionId },
  });

  return true;
}
