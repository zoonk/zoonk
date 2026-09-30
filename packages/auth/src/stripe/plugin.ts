import { stripe } from "@better-auth/stripe";
import { PAID_PLANS } from "@zoonk/utils/subscription";
import { stripeClient } from "./client";
import { reportSubscriptionChange } from "./subscription-events";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

type ReportedSubscription = { plan: string; referenceId: string };

function reportChange(change: "canceled" | "started", subscription: ReportedSubscription) {
  return reportSubscriptionChange({
    change,
    plan: subscription.plan,
    referenceId: subscription.referenceId,
  });
}

/**
 * Stripe customers are created at the first checkout instead of at sign-up, so guests and learners
 * who never subscribe don't become billing records.
 */
export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: false,
    organization: { enabled: true },
    stripeClient,
    stripeWebhookSecret: webhookSecret,
    subscription: {
      enabled: true,
      getCheckoutSessionParams: () => ({ params: { allow_promotion_codes: true } }),
      // Canceling keeps Plus until the period ends, so the decision counts when it becomes
      // pending; a subscription ended right away (or by failed payments) was never pending.
      onSubscriptionCancel: ({ subscription }) => reportChange("canceled", subscription),
      // Stripe confirmed a checkout; the learner may never come back to the page it returns to.
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
}
