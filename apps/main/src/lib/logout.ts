"use client";

import { logout as authLogout } from "@zoonk/auth/client";
import { resetPostHogUser } from "./posthog";

/**
 * Clears the browser's analytics identity before ending the Better Auth session, so the next
 * anonymous or shared-device visitor isn't linked to the learner who's leaving.
 */
export async function logout() {
  await resetPostHogUser();
  authLogout();
}
