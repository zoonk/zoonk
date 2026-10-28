import { safeAsync } from "@zoonk/utils/error";
import { announceAuthChange } from "./auth/auth-change";
import { resetPostHogUser } from "./posthog";

/**
 * Analytics are unlinked first, so the next visitor on this browser isn't taken for the learner. Each
 * step is best effort: failing analytics never keep the session from ending or the tabs from hearing.
 */
export async function endLearnerSession(endSession: () => Promise<unknown>): Promise<void> {
  try {
    const { error } = await safeAsync(resetPostHogUser);

    if (error) {
      globalThis.reportError(error);
    }

    await endSession();
  } finally {
    announceAuthChange();
  }
}
