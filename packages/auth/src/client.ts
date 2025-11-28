import { stripeClient } from "@better-auth/stripe/client";
import {
  adminClient,
  emailOTPClient,
  inferOrgAdditionalFields,
  organizationClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import type { auth } from "./auth";

export const authClient = createAuthClient({
  plugins: [
    adminClient(),
    emailOTPClient(),
    organizationClient({
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
    stripeClient({
      subscription: true,
    }),
  ],
});
