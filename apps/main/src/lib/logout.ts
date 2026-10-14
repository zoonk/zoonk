"use client";

import { resetPostHogUser } from "./posthog";

/**
 * Clears the browser's analytics identity before ending the Better Auth session, so the next
 * anonymous or shared-device visitor isn't linked to the learner who's leaving. The auth client
 * loads when the learner logs out, so the menus that offer it don't ship it up front.
 */
export async function logout() {
  const [{ logout: authLogout }] = await Promise.all([
    import("@zoonk/auth/client"),
    resetPostHogUser(),
  ]);

  await authLogout();
}
