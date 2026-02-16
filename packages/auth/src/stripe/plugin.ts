import { stripe } from "@better-auth/stripe";
import { PAID_PLANS } from "@zoonk/utils/subscription";
import { stripeClient } from "./client";

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: true,
    organization: { enabled: true },
    stripeClient,
    stripeWebhookSecret: webhookSecret,
    subscription: {
      enabled: true,
      getCheckoutSessionParams: () => ({
        params: {
          allow_promotion_codes: true,
          billing_address_collection: "required",
          tax_id_collection: { enabled: true },
        },
      }),
      plans: PAID_PLANS.map((plan) => ({
        annualDiscountLookupKey: plan.annualLookupKey,
        lookupKey: plan.lookupKey,
        name: plan.name,
      })),
    },
  });
}
