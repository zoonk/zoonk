import { stripeClient } from "@better-auth/stripe/client";
import { apiUrl } from "@zoonk/utils";
import {
  adminClient,
  emailOTPClient,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";
import { ac, admin, member, owner } from "./permissions";

export const authClient = createAuthClient({
  basePath: "/v1/auth",
  baseURL: apiUrl,
  plugins: [
    adminClient(),
    emailOTPClient(),
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
