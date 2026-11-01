import { getEnvironment } from "@zoonk/utils/environment";
import Stripe from "stripe";
import { stripeE2EFetch } from "./e2e-fetch";

const secretKey = process.env.STRIPE_SECRET_KEY || "sk_test_dummykey1234567890";

export const stripeClient = new Stripe(secretKey, {
  apiVersion: "2026-10-28.endive",
  ...(getEnvironment() === "e2e" && { httpClient: Stripe.createFetchHttpClient(stripeE2EFetch) }),
});
