import "server-only";
import { startListeningSets } from "@/lib/listening-sets";
import { type ContentAnalytics } from "@/workflows/v2/_shared/content-analytics";
import { listListeningPartsToPrepare } from "@zoonk/core/exams/listening/prepare";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** Routes only: it reads the database, which workflow code can't. `userId` comes from the session. */
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
