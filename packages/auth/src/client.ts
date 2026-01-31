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

// When using Better Auth from apps, we use the default `api/auth` base path.
// However, in the API, we use a different base path, so this value can be overridden
export const basePath = process.env.NEXT_PUBLIC_AUTH_BASE_PATH || "/api/auth";

export const authClient = createAuthClient({
  basePath,
  plugins: [
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
  ],
});
