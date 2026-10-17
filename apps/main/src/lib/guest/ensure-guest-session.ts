import { beginLocalAuthChange } from "@/lib/learner/learner-identity";
import { SESSION_HINT_HEADER } from "@zoonk/auth/session-hint";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Only a check that answered "no session" makes a guest. A check that failed (a rate limit, a
 * network error) says nothing about the session, and signing in anonymously then would replace a
 * signed-in learner's session with a new guest: callers show a retryable error instead. The auth
 * client loads on the first tap that needs it, so the pages whose links can start a lesson
 * (every lesson link, the public pages' starts) don't ship it up front.
 */
async function startGuestSession(): Promise<boolean> {
  const { data: auth, error: loadError } = await safeAsync(() => import("@zoonk/auth/client"));

  if (loadError) {
    logError("[ensureGuestSession] Could not load the auth client:", loadError);
    return false;
  }

  const { authClient } = auth;
  const { data, error: checkError } = await authClient.getSession();

  if (checkError) {
    logError("[ensureGuestSession] Could not check the session:", checkError);
    return false;
  }

  if (data) {
    return true;
  }

  // The tab makes the guest itself: the hint changing under its own sign-in raises no alarm, and
  // the page goes on as the guest only if the browser still holds the guest's session when it
  // answers (another tab may have signed in meanwhile).
  const change = beginLocalAuthChange();
  const answer = { tag: null as string | null };

  try {
    const { data: guest, error } = await authClient.signIn.anonymous({
      fetchOptions: {
        onResponse: ({ response }) => {
          answer.tag = response.headers.get(SESSION_HINT_HEADER);
        },
      },
    });

    if (error) {
      logError("[ensureGuestSession] Could not start a guest session:", error);
      return false;
    }

    return change.complete({ actor: guest.user.id, tag: answer.tag });
  } finally {
    change.release();
  }
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
