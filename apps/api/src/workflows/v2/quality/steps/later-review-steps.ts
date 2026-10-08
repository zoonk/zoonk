import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import {
  prepareLaterReview,
  pullLessonForFix,
  toLaterReviewProblems,
} from "@zoonk/core/library/quality/later-reviews";
import { type PublishedLessonOutcome } from "@zoonk/core/library/quality/published-checks";
import { withAiRetry } from "../../_shared/ai-retry";

/** A later review's finding, ready for `settlePublishedLesson`; null when it couldn't run. */
export type LaterReviewOutcome = { outcome: PublishedLessonOutcome; version: number } | null;

/**
 * Reads one published lesson again with the lesson quality check, whose reviewer comes from
 * another family than the writer and is as strong as the lesson is likely to be read again
 * (`getLessonCheckModels`), at the flex tier: nobody waits on it, so it's answered best
 * effort at about half the price. Something wrong it finds (`toLaterReviewProblems`) is held
 * against the current version, which a fresh draft then replaces; null when the lesson can't be
 * reviewed (no readable plan or no screens).
 */
export async function reviewLessonLaterStep({
  lessonId,
  workflowRunId,
}: {
  lessonId: string;
  workflowRunId: string;
}): Promise<LaterReviewOutcome> {
  "use step";

  const review = await prepareLaterReview(lessonId);

  if (!review) {
    return null;
  }

  const { version, ...input } = review;

  const { data } = await withAiRetry(() =>
    checkLessonQuality({
      ...input,
      analytics: { contentScope: "shared", traceId: workflowRunId },
      serviceTier: chooseServiceTier({ wait: "later" }),
    }),
  );

  const problems = toLaterReviewProblems(data.issues);

  if (problems.length === 0) {
    return { outcome: { status: "passed" }, version };
  }

  return {
    outcome: {
      draft: {
        heldBackAt: new Date().toISOString(),
        model: review.writerModel,
        problems,
        runId: workflowRunId,
      },
      incorrect: true,
      status: "heldBack",
    },
    version,
  };
}

/** Takes a lesson out of play until it's written again; true when it was still published. */
export async function pullLessonStep(lessonId: string): Promise<boolean> {
  "use step";

  return pullLessonForFix(lessonId);
}
