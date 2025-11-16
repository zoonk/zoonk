import { prisma } from "@zoonk/db";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { admin, emailOTP } from "better-auth/plugins";
import { appleProvider } from "./apple";
import { googleProvider } from "./google";
import { sendVerificationOTP } from "./otp";
import { stripePlugin } from "./stripe";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;

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
    ...appleProvider,
    ...googleProvider,
  },
  trustedOrigins: ["https://appleid.apple.com"],
});
