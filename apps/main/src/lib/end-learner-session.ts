import { safeAsync } from "@zoonk/utils/error";
import { announceSignOut } from "./learner/learner-store";
import { resetPostHogUser } from "./posthog";

/**
 * What the browser forgets when a learner's session ends, whatever ends it (logging out, deleting
 * the account): analytics unlinked first, so the next visitor on this browser isn't taken for
 * them, then, once `endSession` returns (or fails), the other tabs told to drop the learner too.
 * The session hint goes with the session cookie, in the response that ends it. Each step is best
 * effort: analytics that fail (PostHog not loading) are reported and never keep the session from
 * ending or the other tabs from hearing it.
 */
export async function endLearnerSession(endSession: () => Promise<unknown>): Promise<void> {
  try {
    const { error } = await safeAsync(resetPostHogUser);

    if (error) {
      globalThis.reportError(error);
    }

    await endSession();
  } finally {
    announceSignOut();
  }
}
