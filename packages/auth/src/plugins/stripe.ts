import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY ?? "sk_test_dummykey1234567890";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: true,
    organization: { enabled: true },
    stripeClient: new Stripe(secretKey, { apiVersion: "2025-12-15.clover" }),
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
      plans: [
        {
          annualDiscountLookupKey: "hobby_yearly",
          lookupKey: "hobby_monthly",
          name: "hobby",
        },
      ],
    },
  });
}
