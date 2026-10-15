import { safeAsync } from "@zoonk/utils/error";
import { endLearnerSession } from "./end-learner-session";

/**
 * The session went with the deleted account (the learner's own deletion, or an age answer under
 * 13), so the browser forgets the learner as a logout does (`endLearnerSession`, its other tabs
 * included) and its cookies, which could otherwise show the account as signed in for the rest of
 * the session cache, even when the server says that session is gone already. The auth client
 * loads only then, so the page that offers deleting the account doesn't ship it up front.
 */
export async function forgetDeletedSession() {
  const auth = import("@zoonk/auth/client");

  await endLearnerSession(() =>
    safeAsync(async () => {
      const { authClient } = await auth;
      await authClient.signOut();
    }),
  );
}
