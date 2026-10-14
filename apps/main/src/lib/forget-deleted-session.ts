import { safeAsync } from "@zoonk/utils/error";
import { resetPostHogUser } from "./posthog";

/**
 * The session went with the deleted account (the learner's own deletion, or an age answer under
 * 13), so the browser forgets its cookies, which could otherwise show the account as signed in
 * for the rest of the session cache, and unlinks analytics from it. The auth client loads only
 * then, so the page that offers deleting the account doesn't ship it up front.
 */
export async function forgetDeletedSession() {
  await safeAsync(async () => {
    const { authClient } = await import("@zoonk/auth/client");
    await authClient.signOut();
  });

  await resetPostHogUser();
}
