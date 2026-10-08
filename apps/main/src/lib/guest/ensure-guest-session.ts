import { authClient } from "@zoonk/auth/client";
import { logError } from "@zoonk/utils/logger";

async function startGuestSession(): Promise<boolean> {
  const { data } = await authClient.getSession();

  if (data) {
    return true;
  }

  const { error } = await authClient.signIn.anonymous();

  if (error) {
    logError("[ensureGuestSession] Could not start a guest session:", error);
  }

  return !error;
}

/** The check or sign-in in flight, so callers at the same moment share one guest. */
let pending: Promise<boolean> | null = null;

/**
 * Makes a visitor a guest (an anonymous account behind BotID): when they open a written lesson,
 * whose screens load only with a session; when they press "Start this lesson" on one that isn't
 * written yet (on its public page or in the player); when they start a course; or when they
 * submit a goal. Nothing that writes content starts on a page load, so a guest made by opening a
 * page costs no AI. Signing up later moves everything to their account. Two callers at once (a
 * lesson's screens and its start) wait for the same sign-in instead of making two guests.
 */
export function ensureGuestSession(): Promise<boolean> {
  pending ??= startGuestSession().finally(() => {
    pending = null;
  });

  return pending;
}
