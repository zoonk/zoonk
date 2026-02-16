import { stripeClient } from "@better-auth/stripe/client";
import {
  adminClient,
  apiKeyClient,
  emailOTPClient,
  inferOrgAdditionalFields,
  oneTimeTokenClient,
  organizationClient,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { type auth } from "./auth";
import { BETTER_AUTH_BASE_PATH } from "./constants";
import { ac, admin, member, owner } from "./permissions";

export function logout() {
  void authClient.signOut({
    fetchOptions: {
      onSuccess: () => {
        globalThis.location.href = "/";
      },
    },
  });
}

export const authClient = createAuthClient({
  basePath: BETTER_AUTH_BASE_PATH,
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
    usernameClient(),
  ],
});
