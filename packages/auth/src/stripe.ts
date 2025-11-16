import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY as string;
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

export function isStripeEnabled() {
  return Boolean(secretKey && webhookSecret);
}

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

function stripeInstance() {
  return stripe({
    createCustomerOnSignUp: true,
    stripeClient: new Stripe(secretKey, { apiVersion: "2025-09-30.clover" }),
    stripeWebhookSecret: webhookSecret,
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

export function stripePlugin() {
  if (isStripeEnabled()) {
    return [stripeInstance()];
  }

  return [];
}
