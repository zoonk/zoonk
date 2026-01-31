import { prisma } from "@zoonk/db";
import { getDevTrustedOrigins, getVercelTrustedOrigins } from "@zoonk/utils/url";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  admin as adminPlugin,
  bearer,
  emailOTP,
  jwt,
  oneTimeToken,
  organization,
} from "better-auth/plugins";
import { type BetterAuthOptions } from "better-auth/types";
import { BETTER_AUTH_BASE_PATH } from "./constants";
import { ac, admin, member, owner } from "./permissions";
import { sendVerificationOTP } from "./plugins/otp";
import { stripePlugin } from "./plugins/stripe";
import { trustedOriginPlugin } from "./plugins/trusted-origin";
import { appleProvider } from "./providers/apple";
import { googleProvider } from "./providers/google";

const SESSION_EXPIRES_IN_DAYS = 30;
const COOKIE_CACHE_MINUTES = 60;

// We don't want to limit the number of memberships or organizations
// So we use the maximum safe integer because Better Auth doesn't support infinity.
const AUTH_MEMBERSHIP_LIMIT = Number.MAX_SAFE_INTEGER;
const AUTH_ORGANIZATION_LIMIT = Number.MAX_SAFE_INTEGER;

/**
 * Base auth config shared between production and E2E.
 * Does NOT include rateLimit or emailAndPassword - those differ per environment.
 */
export const baseAuthConfig: Omit<BetterAuthOptions, "rateLimit"> = {
  account: {
    accountLinking: { enabled: true },
  },
  advanced: {
    database: { generateId: "serial" },
  },
  appName: "Zoonk",
  basePath: BETTER_AUTH_BASE_PATH,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  experimental: {
    joins: true,
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
    "https://zoonk.app",
    "https://*.zoonk.app",
    "https://zoonk.school",
    "https://*.zoonk.school",
    "https://zoonk.team",
    "https://*.zoonk.team",
    ...getDevTrustedOrigins(),
    ...getVercelTrustedOrigins(),
  ],
};

export const baseAuthPlugins = [
  adminPlugin(),
  organization({
    ac,
    // Temporarily disable organization creation
    // We'll support this in the future
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

export const fullPlugins = [
  emailOTP({
    overrideDefaultEmailVerification: true,
    sendVerificationOTP,
    storeOTP: "hashed",
  }),
  oneTimeToken({
    storeToken: "hashed",
  }),
  jwt(),
  bearer(),
  stripePlugin(),
  trustedOriginPlugin(),
  // NextCookies should be the last plugin in the array
  nextCookies(),
] as const;

export const socialProviders = {
  ...appleProvider,
  ...googleProvider,
};
