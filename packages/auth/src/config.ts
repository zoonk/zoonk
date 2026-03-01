import { prismaAdapter } from "@better-auth/prisma-adapter";
import { prisma } from "@zoonk/db";
import { getBaseUrl, getDevTrustedOrigins, getVercelTrustedOrigins } from "@zoonk/utils/url";
import { nextCookies } from "better-auth/next-js";
import {
  admin as adminPlugin,
  bearer,
  emailOTP,
  jwt,
  oneTimeToken,
  openAPI,
  organization,
  username,
} from "better-auth/plugins";
import { type BetterAuthOptions } from "better-auth/types";
import { BETTER_AUTH_BASE_PATH } from "./constants";
import { getCrossSubDomainCookies } from "./env";
import { ac, admin, member, owner } from "./permissions";
import { sendVerificationOTP } from "./plugins/otp";
import { trustedOriginPlugin } from "./plugins/trusted-origin";
import { appleProvider } from "./providers/apple";
import { googleProvider } from "./providers/google";
import { stripePlugin } from "./stripe/plugin";
import { isUsernameAllowed } from "./username-validator";

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
    crossSubDomainCookies: getCrossSubDomainCookies(),
    database: { generateId: "serial" },
  },
  appName: "Zoonk",
  basePath: BETTER_AUTH_BASE_PATH,
  baseURL: getBaseUrl(),
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
    "https://zoonk.dev",
    "https://*.zoonk.dev",
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
  username({
    usernameValidator: (value) => isUsernameAllowed(value),
  }),
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
  openAPI({ disableDefaultReference: true }),
  // NextCookies should be the last plugin in the array
  nextCookies(),
] as const;

export const socialProviders = {
  ...appleProvider,
  ...googleProvider,
};
