import { stripeClient } from "@better-auth/stripe/client";
import {
  adminClient,
  apiKeyClient,
  emailOTPClient,
  inferOrgAdditionalFields,
  oneTimeTokenClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { type auth } from "./auth";
import { ac, admin, member, owner } from "./permissions";

/**
 * Base client config shared between production and E2E.
 * E2E overrides baseURL to use the current origin.
 */
const plugins = [
  adminClient(),
  apiKeyClient(),
  emailOTPClient(),
  oneTimeTokenClient(),
  organizationClient({
    ac,
    roles: { admin, member, owner },
    schema: inferOrgAdditionalFields<typeof auth>(),
  }),
  stripeClient({
    subscription: true,
  }),
];

export const baseClientConfig = {
  basePath: "/v1/auth" as const,
  plugins,
};

export const authClient = createAuthClient({
  ...baseClientConfig,
  baseURL: process.env.NEXT_PUBLIC_API_URL || "https://api.zoonk.com",
});
