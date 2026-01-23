import { stripeClient } from "@better-auth/stripe/client";
import {
  adminClient,
  emailOTPClient,
  inferOrgAdditionalFields,
  oneTimeTokenClient,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { ac, admin, member, owner } from "./permissions";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
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
