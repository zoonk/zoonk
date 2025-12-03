import { prisma } from "@zoonk/db";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  admin as adminPlugin,
  emailOTP,
  organization,
} from "better-auth/plugins";
import type { BetterAuthOptions } from "better-auth/types";
import { appleProvider } from "./apple";
import { googleProvider } from "./google";
import { sendVerificationOTP } from "./otp";
import { ac, admin, member, owner } from "./permissions";
import { stripePlugin } from "./stripe";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;

export const baseAuthConfig: BetterAuthOptions = {
  account: {
    accountLinking: { enabled: true },
  },
  advanced: {
    crossSubDomainCookies: { domain: "zoonk.com", enabled: true },
    database: { generateId: "serial" },
  },
  appName: "Zoonk",
  basePath: "/v1",
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  experimental: {
    joins: true,
  },
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
  trustedOrigins: [
    "https://appleid.apple.com",
    "https://zoonk.com",
    "https://*.zoonk.com",
    "https://zoonk.vercel.app",
    "https://*-zoonk.vercel.app",
    "http://localhost:3000",
    "http://localhost:3001",
  ],
};

export const baseAuthPlugins = [
  adminPlugin(),
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
] as const;

export const auth = betterAuth({
  ...baseAuthConfig,
  plugins: [
    ...baseAuthPlugins,
    emailOTP({
      overrideDefaultEmailVerification: true,
      sendVerificationOTP,
      storeOTP: "hashed",
    }),
    stripePlugin(),
    // nextCookies should be the last plugin in the array
    nextCookies(),
  ],
  socialProviders: {
    ...appleProvider,
    ...googleProvider,
  },
});
