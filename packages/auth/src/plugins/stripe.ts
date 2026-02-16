import { stripe } from "@better-auth/stripe";
import { PAID_PLANS } from "@zoonk/utils/subscription";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY || "sk_test_dummykey1234567890";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: true,
    organization: { enabled: true },
    stripeClient: new Stripe(secretKey, { apiVersion: "2026-01-28.clover" }),
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
