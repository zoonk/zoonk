"use client";

import { announceSignOut } from "./learner/learner-store";
import { setNoSessionHint } from "./learner/session-hint";
import { resetPostHogUser } from "./posthog";

/**
 * Clears the browser's analytics identity and its session hint before ending the Better Auth
 * session, so the next anonymous or shared-device visitor isn't linked to the learner who's
 * leaving, then tells the browser's other tabs to drop the learner too. The auth client loads when
 * the learner logs out, so the menus that offer it don't ship it up front.
 */
export async function logout() {
  const [{ logout: authLogout }] = await Promise.all([
    import("@zoonk/auth/client"),
    resetPostHogUser(),
    setNoSessionHint(),
  ]);

  await authLogout();
  announceSignOut();
}
