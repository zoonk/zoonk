import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import { getAppleClientSecret } from "./apple";
import { sendVerificationOTP } from "./otp";
import { stripePlugin } from "./stripe";

const isProduction = process.env.NODE_ENV === "production";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;
const APPLE_CLIENT_SECRET = isProduction ? await getAppleClientSecret() : "";

export const auth = betterAuth({
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
    stripePlugin(),
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
