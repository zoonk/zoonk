import Stripe from "stripe";

const secretKey = process.env.STRIPE_SECRET_KEY || "sk_test_dummykey1234567890";

export const stripeClient = new Stripe(secretKey, { apiVersion: "2026-02-25.clover" });
