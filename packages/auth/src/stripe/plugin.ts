import { stripe } from "@better-auth/stripe";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { PAID_PLANS } from "@zoonk/utils/subscription";
import { type BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware, getSessionFromCtx } from "better-auth/api";
import { z } from "zod";
import { ACTIVE_SUBSCRIPTION_STATUSES } from "../active-subscription";
import { issueEarnedCertificates } from "../certificate-issuance";
import { getCheckoutSessionParams } from "./checkout-session-params";
import { stripeClient } from "./client";
import { endWebPlusBesideStorePlus } from "./settle-web-plus";
import { saveSubscription } from "./stop-web-plus";
import { reportSubscriptionChange } from "./subscription-events";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const upgradeBodySchema = z.object({
  annual: z.boolean().optional(),
  locale: z.string().optional(),
});

type ReportedSubscription = { plan: string; referenceId: string };

function reportChange(change: "canceled" | "started", subscription: ReportedSubscription) {
  return reportSubscriptionChange({
    change,
    plan: subscription.plan,
    referenceId: subscription.referenceId,
  });
}

const PAID_CHECKOUT: ReadonlySet<Stripe.Checkout.Session.PaymentStatus> = new Set([
  "no_payment_required",
  "paid",
]);

function getId(object: string | { id: string } | null): string | undefined {
  return typeof object === "string" ? object : object?.id;
}

function getCheckoutLearner(checkout: Stripe.Checkout.Session): string | null {
  return checkout.client_reference_id ?? checkout.metadata?.referenceId ?? null;
}

function isGranting(subscription: Stripe.Subscription): boolean {
  return ACTIVE_SUBSCRIPTION_STATUSES.includes(subscription.status);
}

/**
 * A verified grant issues the learner's certificates even when our copy of the subscription
 * already reads ended, such as a refund handled first: they had Plus, and issued certificates
 * stay.
 */
function issueOnGrant({ grantedAt, userId }: { grantedAt: Date; userId: string }) {
  return prisma.$transaction((tx) =>
    issueEarnedCertificates(tx, { now: new Date(), plus: { grantedAt }, userId }),
  );
}

async function findGrantedLearner(event: Stripe.Event): Promise<string | null> {
  if (event.type === "checkout.session.completed") {
    const checkout = event.data.object;

    return checkout.mode === "subscription" && PAID_CHECKOUT.has(checkout.payment_status)
      ? getCheckoutLearner(checkout)
      : null;
  }

  const isSubscriptionSaved =
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated";

  if (!isSubscriptionSaved || !isGranting(event.data.object)) {
    return null;
  }

  const row = await prisma.subscription.findFirst({
    select: { referenceId: true },
    where: { stripeSubscriptionId: event.data.object.id },
  });

  return row?.referenceId ?? null;
}

/**
 * Better Auth saves a subscription as it read it, in its webhooks and on the page a checkout
 * returns to, and Stripe may have ended it since: events arrive in any order, and store Plus can
 * end a checkout's subscription before any row names it. Ending is final, so saving an ended one
 * never undoes a newer state.
 */
async function saveIfEnded(subscription: Stripe.Subscription) {
  if (subscription.status === "canceled") {
    await saveSubscription(subscription);
  }
}

/**
 * No webhook follows the save on the page a checkout returns to, and the learner landing back
 * should find their certificates issued: only the checkout's own learner, since the page takes any
 * checkout's id. A failure here only logs, so the learner who just paid still lands on their page;
 * the webhook issues them again.
 */
const settleReturnedCheckout = createAuthMiddleware(async (context) => {
  const checkoutSessionId: unknown = context.query?.checkoutSessionId;
  const session = await getSessionFromCtx(context);

  if (typeof checkoutSessionId !== "string" || !session) {
    return;
  }

  const { error } = await safeAsync(async () => {
    const checkout = await stripeClient.checkout.sessions.retrieve(checkoutSessionId, {
      expand: ["subscription"],
    });

    if (!checkout.subscription || typeof checkout.subscription === "string") {
      return;
    }

    await saveIfEnded(checkout.subscription);

    if (getCheckoutLearner(checkout) === session.user.id && isGranting(checkout.subscription)) {
      await issueOnGrant({ grantedAt: new Date(), userId: session.user.id });
    }
  });

  if (error) {
    logError("Checking a returned checkout's subscription failed", { checkoutSessionId, error });
  }
});

async function settleEndedSubscriptions(event: Stripe.Event) {
  if (event.type === "customer.subscription.deleted") {
    await saveSubscription(event.data.object);
    return;
  }

  if (event.type === "customer.subscription.updated") {
    await saveIfEnded(await stripeClient.subscriptions.retrieve(event.data.object.id));
    return;
  }

  if (event.type !== "checkout.session.completed" || event.data.object.mode !== "subscription") {
    return;
  }

  const checkout = event.data.object;
  const userId = getCheckoutLearner(checkout);

  if (!userId) {
    return;
  }

  await endWebPlusBesideStorePlus({ customerId: getId(checkout.customer), userId });
  const subscriptionId = getId(checkout.subscription);

  if (subscriptionId) {
    await saveIfEnded(await stripeClient.subscriptions.retrieve(subscriptionId));
  }
}

/**
 * Runs after Better Auth's own handling of each event. Unlike its callbacks, a failure here fails
 * the webhook, so Stripe delivers it again: until the learner holds one Plus, until a subscription
 * Stripe ended is saved, since Better Auth only logs a failed save and our copy would go on giving
 * Plus, and until a grant has issued the learner's certificates.
 */
async function onStripeEvent(event: Stripe.Event) {
  await settleEndedSubscriptions(event);
  const granted = await findGrantedLearner(event);

  if (granted) {
    // Stripe dates an event to the second, so its grant covers everything earned in that second.
    await issueOnGrant({ grantedAt: new Date((event.created + 1) * 1000 - 1), userId: granted });
  }
}

export function stripePlugin() {
  const plugin = stripe({
    createCustomerOnSignUp: false,
    onEvent: onStripeEvent,
    organization: { enabled: true },
    stripeClient,
    stripeWebhookSecret: webhookSecret,
    subscription: {
      enabled: true,
      getCheckoutSessionParams: async (_data, _request, ctx) => {
        const { annual, locale } = upgradeBodySchema.parse(ctx.body);

        return { params: await getCheckoutSessionParams({ annual: annual === true, locale }) };
      },
      // Canceling keeps Plus until the period ends, so the decision counts when it becomes
      // pending; a subscription ended right away (or by failed payments) was never pending.
      onSubscriptionCancel: ({ subscription }) => reportChange("canceled", subscription),
      onSubscriptionComplete: ({ subscription }) => reportChange("started", subscription),
      onSubscriptionDeleted: async ({ subscription }) => {
        if (!subscription.cancelAtPeriodEnd && !subscription.cancelAt) {
          await reportChange("canceled", subscription);
        }
      },
      plans: PAID_PLANS.map((plan) => ({
        annualDiscountLookupKey: plan.annualLookupKey,
        lookupKey: plan.lookupKey,
        name: plan.name,
      })),
    },
  });

  return {
    ...plugin,
    hooks: {
      after: [
        {
          handler: settleReturnedCheckout,
          matcher: (context) => context.path === "/subscription/success",
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
