"use client";

import { endLearnerSession } from "./end-learner-session";
import { beginLocalAuthChange } from "./learner/learner-identity";

/**
 * Ends the learner's Better Auth session, after the browser forgot them (`endLearnerSession`). The
 * tab changes the session itself: the moment the app's session has ended, the page is covered and
 * the other tabs hear it, before central auth answers or the page leaves; a sign-out that fails
 * leaves the page as it was. The auth client loads when the learner logs out, so the menus that
 * offer it don't ship it up front.
 */
export async function logout() {
  const auth = import("@zoonk/auth/client");
  const change = beginLocalAuthChange();

  try {
    await endLearnerSession(async () => {
      const { logout: authLogout } = await auth;
      await authLogout({ onAppSignedOut: () => change.complete({ actor: null, tag: null }) });
    });
  } finally {
    change.release();
  }
}
