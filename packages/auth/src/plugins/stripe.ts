import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY || "sk_test_dummykey1234567890";
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: true,
    stripeClient: new Stripe(secretKey, { apiVersion: "2025-12-15.clover" }),
    stripeWebhookSecret: webhookSecret,
    subscription: {
      enabled: true,
      getCheckoutSessionParams: () => ({
        // biome-ignore-start lint/style/useNamingConvention: stripe api
        params: {
          allow_promotion_codes: true,
          billing_address_collection: "required",
          tax_id_collection: { enabled: true },
        },
        // biome-ignore-end lint/style/useNamingConvention: stripe api
      }),
      plans: [
        {
          annualDiscountLookupKey: "plus_yearly",
          lookupKey: "plus_monthly",
          name: "plus",
        },
      ],
    },
  });
}
