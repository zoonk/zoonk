import { stripe } from "@better-auth/stripe";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, type EmailOTPOptions, emailOTP } from "better-auth/plugins";
import Stripe from "stripe";
import { getAppleClientSecret } from "./apple";

const isProduction = process.env.NODE_ENV === "production";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;
const APPLE_CLIENT_SECRET = isProduction ? await getAppleClientSecret() : "";

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

const stripeClient = new Stripe(STRIPE_SECRET_KEY, {
  apiVersion: "2025-09-30.clover",
});

export type SendVerificationOTP = EmailOTPOptions["sendVerificationOTP"];

export type AuthSetup = {
  sendVerificationOTP: SendVerificationOTP;
};

export function zoonkAuth({ sendVerificationOTP }: AuthSetup) {
  return betterAuth({
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    plugins: [
      nextCookies(),
      admin(),
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOTP,
        storeOTP: "hashed",
      }),
      stripe({
        createCustomerOnSignUp: true,
        stripeClient,
        stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
        subscription: {
          enabled: true,
          getCheckoutSessionParams: async () => ({
            params: {
              allow_promotion_codes: true,
              billing_address_collection: "required",
              tax_id_collection: { enabled: true },
            },
          }),
          plans: [
            {
              annualDiscountLookupKey: "plus_yearly",
              lookupKey: "plus_monthly",
              name: "plus",
            },
          ],
        },
      }),
    ],
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 60 * COOKIE_CACHE_MINUTES,
      },
      expiresIn: 60 * 60 * 24 * SESSION_EXPIRES_IN_DAYS,
    },
    socialProviders: {
      apple: {
        clientId: process.env.APPLE_CLIENT_ID as string,
        clientSecret: APPLE_CLIENT_SECRET,
      },
      google: {
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        prompt: "select_account",
      },
    },
    trustedOrigins: ["https://appleid.apple.com"],
  });
}
