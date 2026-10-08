import { authClient } from "@zoonk/auth/client";
import { safeAsync } from "@zoonk/utils/error";
import { resetPostHogUser } from "./posthog";

/**
 * The session went with the deleted account (the learner's own deletion, or an age answer under
 * 13), so the browser forgets its cookies, which could otherwise show the account as signed in
 * for the rest of the session cache, and unlinks analytics from it.
 */
export async function forgetDeletedSession() {
  await safeAsync(() => authClient.signOut());
  await resetPostHogUser();
}
