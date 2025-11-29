import { prisma } from "@zoonk/db";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  admin as adminPlugin,
  emailOTP,
  organization,
} from "better-auth/plugins";
import { appleProvider } from "./apple";
import { googleProvider } from "./google";
import { sendVerificationOTP } from "./otp";
import { ac, admin, member, owner } from "./permissions";
import { stripePlugin } from "./stripe";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;

export const auth = betterAuth({
  account: {
    accountLinking: { enabled: true },
  },
  advanced: {
    database: { generateId: "serial" },
  },
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  experimental: {
    joins: true,
  },
  plugins: [
    nextCookies(),
    adminPlugin(),
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOTP,
      storeOTP: "hashed",
    }),
    organization({
      ac,
      // temporarily disable organization creation
      // we'll support this in the future
      allowUserToCreateOrganization: false,
      membershipLimit: Number.POSITIVE_INFINITY,
      organizationLimit: Number.POSITIVE_INFINITY,
      roles: { admin, member, owner },
      schema: {
        organization: {
          additionalFields: {
            kind: { defaultValue: "brand", required: true, type: "string" },
          },
        },
      },
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
