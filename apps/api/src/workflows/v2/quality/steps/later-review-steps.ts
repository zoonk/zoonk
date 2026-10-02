import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import {
  failsLaterReview,
  prepareLaterReview,
  pullLessonForFix,
} from "@zoonk/core/library/quality/later-reviews";
import { withAiRetry } from "../../_shared/ai-retry";

/**
 * Reads one published lesson again with the lesson quality check, whose reviewer comes from
 * another family than the writer, at the flex tier: nobody waits on it, so it's answered best
 * effort at about half the price. True when it finds something wrong; null when the lesson can't
 * be reviewed (no readable plan or no screens).
 */
export async function reviewLessonLaterStep({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<boolean | null> {
  "use step";

  const review = await prepareLaterReview(lessonId);

  if (!review) {
    return null;
  }

  const { data } = await withAiRetry(() =>
    checkLessonQuality({
      ...review,
      analytics: { contentScope: "shared", traceId: workflowRunId },
      serviceTier: "flex",
    }),
  );

  return failsLaterReview(data.issues);
}

/** Takes a lesson out of play until it's written again; true when it was still published. */
export async function pullLessonStep(lessonId: string): Promise<boolean> {
  "use step";

  return pullLessonForFix(lessonId);
}
