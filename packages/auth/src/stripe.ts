import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

type GetCheckoutSessionParamsFn = NonNullable<
  Parameters<typeof stripe>[0]["subscription"]
>["getCheckoutSessionParams"];

const getCheckoutSessionParams: GetCheckoutSessionParamsFn = async () => ({
  // biome-ignore-start lint/style/useNamingConvention: stripe api
  params: {
    allow_promotion_codes: true,
    billing_address_collection: "required",
    tax_id_collection: { enabled: true },
  },
  // biome-ignore-end lint/style/useNamingConvention: stripe api
});

export function stripePlugin() {
  return stripe({
    createCustomerOnSignUp: true,
    stripeClient,
    stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
    subscription: {
      enabled: true,
      getCheckoutSessionParams,
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
