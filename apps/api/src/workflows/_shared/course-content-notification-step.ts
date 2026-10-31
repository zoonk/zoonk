import { notifyCourseContent } from "@zoonk/core/cache/course-content";
import { safeAsync } from "@zoonk/utils/error";
import { RetryableError, getStepMetadata } from "workflow";

export async function notifyCourseContentStep(tags: string[]): Promise<void> {
  "use step";

  const { error } = await safeAsync(() => notifyCourseContent(tags));

  if (error) {
    const delaySeconds = Math.min(60, 2 ** getStepMetadata().attempt);

    throw new RetryableError(`Main cache notification failed: ${error.message}`, {
      retryAfter: new Date(Date.now() + delaySeconds * 1000),
    });
  }
}

// The default three retries all land within seconds, and nothing else sends this again: a short Main
// outage would leave its course cache stale.
notifyCourseContentStep.maxRetries = 30;
