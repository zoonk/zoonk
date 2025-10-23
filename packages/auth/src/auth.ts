import { stripe } from "@better-auth/stripe";
import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { type EmailOTPOptions, emailOTP } from "better-auth/plugins";
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
    database: prismaAdapter(prisma, { provider: "postgresql" }),
    rateLimit: {
      enabled: true,
      storage: "database",
    },
    session: {
      expiresIn: 60 * 60 * 24 * SESSION_EXPIRES_IN_DAYS,
      cookieCache: {
        enabled: true,
        maxAge: 60 * COOKIE_CACHE_MINUTES,
      },
    },
    socialProviders: {
      google: {
        prompt: "select_account",
        clientId: process.env.GOOGLE_CLIENT_ID as string,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      },
      apple: {
        clientId: process.env.APPLE_CLIENT_ID as string,
        clientSecret: APPLE_CLIENT_SECRET,
      },
    },
    trustedOrigins: ["https://appleid.apple.com"],
    account: {
      accountLinking: {
        enabled: true,
      },
    },
    plugins: [
      nextCookies(),
      emailOTP({
        storeOTP: "hashed",
        overrideDefaultEmailVerification: true,
        sendVerificationOTP,
      }),
      stripe({
        stripeClient,
        stripeWebhookSecret: STRIPE_WEBHOOK_SECRET,
        createCustomerOnSignUp: true,
        subscription: {
          enabled: true,
          plans: [
            {
              name: "plus",
              priceId: process.env.STRIPE_PLUS_MONTHLY_PRICE_ID || "",
              annualDiscountPriceId:
                process.env.STRIPE_PLUS_YEARLY_PRICE_ID || "",
            },
          ],
        },
      }),
    ],
  });
}
