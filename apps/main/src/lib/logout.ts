"use client";

import { logout as authLogout } from "@zoonk/core/auth/client";
import { resetPostHogUser } from "./posthog";

/**
 * Clears client-side analytics identity before ending the Better Auth session
 * so the next anonymous or shared-device visitor is not linked to this user.
 */
export function logout() {
  resetPostHogUser();
  authLogout();
}
