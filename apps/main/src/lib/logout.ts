"use client";

import { endLearnerSession } from "./end-learner-session";

/**
 * Ends the learner's Better Auth session, after the browser forgot them (`endLearnerSession`). The
 * auth client loads when the learner logs out, so the menus that offer it don't ship it up front.
 */
export async function logout() {
  const auth = import("@zoonk/auth/client");

  await endLearnerSession(async () => {
    const { logout: authLogout } = await auth;
    await authLogout();
  });
}
