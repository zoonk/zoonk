import { stripeClient } from "@better-auth/stripe/client";
import { safeAsync } from "@zoonk/utils/error";
import { API_URL } from "@zoonk/utils/url";
import {
  adminClient,
  anonymousClient,
  deviceAuthorizationClient,
  emailOTPClient,
  inferOrgAdditionalFields,
  organizationClient,
  usernameClient,
} from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { type auth } from "./auth";
import { BETTER_AUTH_BASE_PATH } from "./config";
import { ac, admin, member, owner } from "./permissions";

const centralAuthClient = createAuthClient({ baseURL: new URL("/v1/auth", API_URL).href });

export function signOutAppHost() {
  return authClient.signOut();
}

/**
 * The app and central auth can share a database session, so this signs out of both. Only this
 * app's sign-out decides whether the page reloads: once it succeeds the account is gone here,
 * whatever central auth answered.
 */
export async function logout() {
  const [{ data }] = await Promise.all([
    safeAsync(signOutAppHost),
    safeAsync(() => centralAuthClient.signOut()),
  ]);

  if (data && !data.error) {
    globalThis.location.href = "/";
  }
}

export const authClient = createAuthClient({
  basePath: BETTER_AUTH_BASE_PATH,
  plugins: [
    adminClient(),
    anonymousClient(),
    deviceAuthorizationClient(),
    emailOTPClient(),
    organizationClient({
      ac,
      roles: { admin, member, owner },
      schema: inferOrgAdditionalFields<typeof auth>(),
    }),
    stripeClient({ subscription: true }),
    usernameClient({ displayUsername: false }),
  ],
});
