import { prisma } from "@zoonk/db";
import { getVercelTrustedOrigins } from "@zoonk/utils/url";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { betterAuth } from "better-auth/minimal";
import { nextCookies } from "better-auth/next-js";
import {
  admin as adminPlugin,
  emailOTP,
  oneTimeToken,
  organization,
} from "better-auth/plugins";
import type { BetterAuthOptions } from "better-auth/types";
import { ac, admin, member, owner } from "./permissions";
import { sendVerificationOTP } from "./plugins/otp";
import { stripePlugin } from "./plugins/stripe";
import { appleProvider } from "./providers/apple";
import { googleProvider } from "./providers/google";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;

// We don't want to limit the number of memberships or organizations
// so we use the maximum safe integer because Better Auth doesn't support infinity.
const AUTH_MEMBERSHIP_LIMIT = Number.MAX_SAFE_INTEGER;
const AUTH_ORGANIZATION_LIMIT = Number.MAX_SAFE_INTEGER;

export const baseAuthConfig: BetterAuthOptions = {
  account: {
    accountLinking: { enabled: true },
  },
  advanced: {
    database: { generateId: "serial" },
  },
  appName: "Zoonk",
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
  trustedOrigins: ["https://appleid.apple.com", ...getVercelTrustedOrigins()],
};

export const baseAuthPlugins = [
  adminPlugin(),
  organization({
    ac,
    // temporarily disable organization creation
    // we'll support this in the future
    allowUserToCreateOrganization: false,
    membershipLimit: AUTH_MEMBERSHIP_LIMIT,
    organizationLimit: AUTH_ORGANIZATION_LIMIT,
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
    oneTimeToken({
      storeToken: "hashed",
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
