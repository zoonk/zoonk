import { announceSignOut } from "./learner/learner-store";
import { setNoSessionHint } from "./learner/session-hint";
import { resetPostHogUser } from "./posthog";

/**
 * What the browser forgets when a learner's session ends, whatever ends it (logging out, deleting
 * the account): analytics unlinked and the session hint dropped first, so the next visitor on this
 * browser isn't taken for them, then, once `endSession` returns (or fails), the other tabs told to
 * drop the learner too. Each step is best effort: one that fails (PostHog not loading, the cookie
 * not being written) is reported and never keeps the session from ending or the other tabs from
 * hearing it.
 */
export async function endLearnerSession(endSession: () => Promise<unknown>): Promise<void> {
  try {
    const forgotten = await Promise.allSettled([resetPostHogUser(), setNoSessionHint()]);

    forgotten.forEach((result) => {
      if (result.status === "rejected") {
        globalThis.reportError(result.reason);
      }
    });

    await endSession();
  } finally {
    announceSignOut();
  }
}
