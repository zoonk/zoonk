"use client";

import { endLearnerSession } from "./end-learner-session";

/** The auth client loads only now, so the menus that offer logging out don't ship it up front. */
export async function logout() {
  const auth = import("@zoonk/auth/client");

  await endLearnerSession(async () => {
    const { logout: authLogout } = await auth;
    await authLogout();
  });
}
