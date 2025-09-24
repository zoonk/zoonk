import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { getAppleClientSecret } from "./auth/apple";
import { sendVerificationOTP } from "./auth/otp";
import prisma from "./prisma";

const isProduction = process.env.NODE_ENV === "production";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;
const APPLE_CLIENT_SECRET = isProduction ? await getAppleClientSecret() : "";

export const auth = betterAuth({
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
  ],
});
