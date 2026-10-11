import "server-only";
import { startListeningSets } from "@/lib/listening-sets";
import { type ContentAnalytics } from "@/workflows/v2/_shared/content-analytics";
import { listListeningPartsToPrepare } from "@zoonk/core/exams/listening/prepare";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * When a learner's session prepares and they heard every recording of a part of their exam, the
 * part's next one starts being made for their next practice, at the flex tier. Nothing starts for
 * a goal without listening or while they have recordings left to hear. `userId` comes from the
 * caller's session access. A failure is logged: the next session prepares again. For routes only:
 * it reads the database, which workflow code can't.
 */
export async function startLearnerListeningSets({
  analytics,
  goalId,
  userId,
}: {
  analytics?: ContentAnalytics;
  goalId: string;
  userId: string;
}): Promise<void> {
  const { error } = await safeAsync(async () => {
    const toPrepare = await listListeningPartsToPrepare({ goalId, userId });

    if (toPrepare && toPrepare.parts.length > 0) {
      await startListeningSets({ analytics, goalId, userId, wait: "later" });
    }
  });

  if (error) {
    logError(`Could not start goal ${goalId}'s next listening recordings.`, error);
  }
}
