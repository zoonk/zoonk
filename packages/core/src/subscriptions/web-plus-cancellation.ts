import "server-only";
import { sendPlusCancellationEmail } from "@zoonk/auth/plus-emails";
import { stripeClient } from "@zoonk/auth/stripe-client";
import { prisma } from "@zoonk/db";
import { type PriceInfo } from "@zoonk/utils/currency";
import { io } from "next/cache";
import { findActiveSubscriptionForUser } from "../auth/subscription";
import { getSession } from "../users/get-session";
import {
  UNPAID_STATUSES,
  getLatestInvoice,
  isUnpaid,
  refundLatestPayment,
  saveStoppedSubscription,
  stopSubscription,
  toDate,
} from "./_utils/stop-web-plus";
import { getWebPlusCancellationTerms } from "./web-plus-cancellation-terms";
import type Stripe from "stripe";

type BillingInterval = "month" | "year";
type Terms = ReturnType<typeof getWebPlusCancellationTerms>;
type Learner = { email: string; id: string; name: string };

export type WebPlusCancellation =
  | { status: "none"; email: string }
  | { status: "store"; provider: "apple" | "google" | "zoonk" }
  | { status: "ending"; endsAt: Date }
  | {
      status: "ready";
      /** Null once the renewal is already stopped, while the 14-day refund is still open. */
      cancellation: Terms["cancellation"] | null;
      currency: string;
      email: string;
      /** When Plus ends, if the renewal is already stopped. */
      endingAt: Date | null;
      interval: BillingInterval;
      name: string;
      /** The last renewal wasn't paid: canceling ends it now and stops the charge attempts. */
      unpaid: boolean;
      withdrawal: Terms["withdrawal"];
    };

export type WebPlusCancellationOutcome =
  | {
      status: "canceled";
      endsAt: Date;
      receivedAt: Date;
      refund: PriceInfo | null;
      /** Stopping the renewal leaves the 14-day refund open until this day. */
      refundableUntil: Date | null;
    }
  | { status: "unavailable" };

type ReadyCancellation = Extract<WebPlusCancellation, { status: "ready" }>;

type LoadedCancellation = {
  cancellation: WebPlusCancellation;
  stripeSubscription: Stripe.Subscription | null;
};

function isPendingCancel(subscription: Stripe.Subscription): boolean {
  return subscription.cancel_at_period_end || subscription.cancel_at !== null;
}

async function readLiveStripeSubscription(id: string): Promise<Stripe.Subscription | null> {
  const subscription = await stripeClient.subscriptions.retrieve(id, {
    expand: ["latest_invoice.payments"],
  });

  return subscription.status === "active" || isUnpaid(subscription) ? subscription : null;
}

function describeCancellation({
  learner,
  now,
  subscription,
}: {
  learner: Learner;
  now: Date;
  subscription: Stripe.Subscription;
}): WebPlusCancellation {
  const item = subscription.items.data[0];
  const invoice = getLatestInvoice(subscription);

  if (!item || !invoice) {
    return { email: learner.email, status: "none" };
  }

  const interval: BillingInterval = item.price.recurring?.interval === "year" ? "year" : "month";
  const ready = { currency: invoice.currency, email: learner.email, interval, name: learner.name };

  if (isUnpaid(subscription)) {
    return {
      ...ready,
      cancellation: { endsAt: now, refundAmount: 0, unstartedMonths: 0 },
      endingAt: null,
      status: "ready",
      unpaid: true,
      withdrawal: null,
    };
  }

  const { cancellation, withdrawal } = getWebPlusCancellationTerms({
    amountPaid: invoice.amount_paid,
    interval,
    now,
    periodEnd: toDate(item.current_period_end),
    periodStart: toDate(item.current_period_start),
    subscribedAt: toDate(subscription.start_date),
  });

  const endingAt = isPendingCancel(subscription)
    ? toDate(subscription.cancel_at ?? item.current_period_end)
    : null;

  if (endingAt && !withdrawal) {
    return { endsAt: endingAt, status: "ending" };
  }

  return {
    ...ready,
    cancellation: endingAt ? null : cancellation,
    endingAt,
    status: "ready",
    unpaid: false,
    withdrawal,
  };
}

function findUnpaidWebSubscription(userId: string) {
  return prisma.subscription.findFirst({
    orderBy: { id: "desc" },
    where: { provider: "stripe", referenceId: userId, status: { in: UNPAID_STATUSES } },
  });
}

async function loadCancellation({
  learner,
  now,
}: {
  learner: Learner;
  now: Date;
}): Promise<LoadedCancellation> {
  const subscription =
    (await findActiveSubscriptionForUser({ now, userId: learner.id })) ??
    (await findUnpaidWebSubscription(learner.id));

  if (!subscription) {
    return { cancellation: { email: learner.email, status: "none" }, stripeSubscription: null };
  }

  if (subscription.provider !== "stripe") {
    return {
      cancellation: { provider: subscription.provider, status: "store" },
      stripeSubscription: null,
    };
  }

  const stripeSubscription = subscription.stripeSubscriptionId
    ? await readLiveStripeSubscription(subscription.stripeSubscriptionId)
    : null;

  if (!stripeSubscription) {
    return { cancellation: { email: learner.email, status: "none" }, stripeSubscription: null };
  }

  return {
    cancellation: describeCancellation({ learner, now, subscription: stripeSubscription }),
    stripeSubscription,
  };
}

async function getLearner(): Promise<Learner | null> {
  const session = await getSession();
  return session && !session.user.isAnonymous ? session.user : null;
}

/** What canceling the learner's Plus would do. Null without an account: a guest has no Plus. */
export async function getWebPlusCancellation(): Promise<WebPlusCancellation | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  await io();

  const { cancellation } = await loadCancellation({ learner, now: new Date() });

  return cancellation;
}

function chooseOption({
  cancellation,
  receivedAt,
  withdraw,
}: {
  cancellation: ReadyCancellation;
  receivedAt: Date;
  withdraw: boolean;
}): { endsAt: Date; refundAmount: number } | null {
  if (!withdraw) {
    return cancellation.cancellation;
  }

  return (
    cancellation.withdrawal && {
      endsAt: receivedAt,
      refundAmount: cancellation.withdrawal.refundAmount,
    }
  );
}

/**
 * The refund goes first, so a failure never leaves Plus ended without it, and a retry finishes what
 * a failed request started. The receipt is emailed in `locale`. Caches aren't expired: main keeps
 * the receipt on screen and reads its pages again when the learner leaves. Null without an account.
 */
export async function cancelWebPlus({
  locale,
  withdraw,
}: {
  locale: string;
  withdraw: boolean;
}): Promise<WebPlusCancellationOutcome | null> {
  const learner = await getLearner();

  if (!learner) {
    return null;
  }

  const receivedAt = new Date();
  const { cancellation, stripeSubscription } = await loadCancellation({ learner, now: receivedAt });

  const option =
    cancellation.status === "ready" ? chooseOption({ cancellation, receivedAt, withdraw }) : null;

  if (cancellation.status !== "ready" || !option || !stripeSubscription) {
    return { status: "unavailable" };
  }

  const { endsAt, refundAmount } = option;
  const refundableUntil = withdraw ? null : (cancellation.withdrawal?.until ?? null);

  const refund =
    refundAmount > 0 ? { amount: refundAmount, currency: cancellation.currency } : null;

  if (refund) {
    await refundLatestPayment({ owed: refund.amount, subscription: stripeSubscription });
  }

  const stopped = await stopSubscription({ endsAt, subscription: stripeSubscription, withdraw });
  await saveStoppedSubscription({ stopped, userId: learner.id });

  await sendPlusCancellationEmail({
    email: learner.email,
    endsAt,
    interval: cancellation.interval,
    locale,
    name: learner.name,
    receivedAt,
    refund,
    refundableUntil,
    withdrawn: withdraw,
  });

  return { endsAt, receivedAt, refund, refundableUntil, status: "canceled" };
}
