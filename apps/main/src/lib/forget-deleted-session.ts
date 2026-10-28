import { safeAsync } from "@zoonk/utils/error";
import { endLearnerSession } from "./end-learner-session";

/**
 * The cookies go too: their session cache could show the account as signed in after the server
 * dropped the session. The auth client loads only now, so the page doesn't ship it up front.
 */
export async function forgetDeletedSession() {
  const auth = import("@zoonk/auth/client");

  await endLearnerSession(() =>
    safeAsync(async () => {
      const { signOutAppHost } = await auth;
      await signOutAppHost();
    }),
  );
}
