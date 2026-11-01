import { stripe } from "@better-auth/stripe";
import { PAID_PLANS } from "@zoonk/utils/subscription";
import { z } from "zod";
import { getCheckoutSessionParams } from "./checkout-session-params";
import { stripeClient } from "./client";
import { sendPlusPurchaseConfirmation } from "./purchase-confirmation";
import { endWebPlusBesideStorePlus, findStorePlus } from "./settle-web-plus";
import { saveSubscription } from "./stop-web-plus";
import { reportSubscriptionChange } from "./subscription-events";
import type Stripe from "stripe";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

const upgradeBodySchema = z.object({
  annual: z.boolean().optional(),
  locale: z.string().optional(),
  metadata: z.object({ timeZone: z.string().optional() }).optional(),
});

type ReportedSubscription = { plan: string; referenceId: string };

function reportChange(change: "canceled" | "started", subscription: ReportedSubscription) {
  return reportSubscriptionChange({
    change,
    plan: subscription.plan,
    referenceId: subscription.referenceId,
  });
}

function getCustomerId(customer: string | { id: string } | null): string | undefined {
  return typeof customer === "string" ? customer : customer?.id;
}

/**
 * Runs after Better Auth's own handling of each event. Unlike its callbacks, a failure here fails
 * the webhook, so Stripe delivers it again: until the learner holds one Plus, and until a
 * subscription Stripe ended is saved, since Better Auth only logs a failed save and our copy would
 * go on giving Plus.
 */
async function onStripeEvent(event: Stripe.Event) {
  if (event.type === "customer.subscription.deleted") {
    const subscription = event.data.object;
    const { referenceId } = subscription.metadata;

    if (referenceId) {
      await saveSubscription({ subscription, userId: referenceId });
    }

    return;
  }

  if (event.type !== "checkout.session.completed" || event.data.object.mode !== "subscription") {
    return;
  }

  const checkout = event.data.object;
  const userId = checkout.client_reference_id ?? checkout.metadata?.referenceId;

  if (userId) {
    await endWebPlusBesideStorePlus({ customerId: getCustomerId(checkout.customer), userId });
  }
}

export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: false,
    onEvent: onStripeEvent,
    organization: { enabled: true },
    stripeClient,
    stripeWebhookSecret: webhookSecret,
    subscription: {
      enabled: true,
      getCheckoutSessionParams: async (_data, _request, ctx) => {
        const { annual, locale, metadata } = upgradeBodySchema.parse(ctx.body);

        return {
          params: await getCheckoutSessionParams({
            annual: annual === true,
            locale,
            timeZone: metadata?.timeZone,
          }),
        };
      },
      // Canceling keeps Plus until the period ends, so the decision counts when it becomes
      // pending; a subscription ended right away (or by failed payments) was never pending.
      onSubscriptionCancel: ({ subscription }) => reportChange("canceled", subscription),
      // Stripe confirmed a checkout; the learner may never come back to the page it returns to.
      // Better Auth logs a failure here, and Stripe isn't asked to retry the webhook. A checkout
      // opened while free can complete after a store purchase, whose Plus the learner keeps.
      onSubscriptionComplete: async ({ stripeSubscription, subscription }) => {
        const [, storePlus] = await Promise.all([
          reportChange("started", subscription),
          findStorePlus(subscription.referenceId),
        ]);

        if (storePlus || stripeSubscription.status !== "active") {
          return;
        }

        await sendPlusPurchaseConfirmation({
          referenceId: subscription.referenceId,
          stripeSubscription,
        });
      },
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
}
