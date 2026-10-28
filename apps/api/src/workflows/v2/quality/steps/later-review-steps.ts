import { chooseServiceTier } from "@zoonk/ai/provider-options";
import { checkLessonQuality } from "@zoonk/ai/tasks/v2/quality/lesson-check";
import {
  prepareLaterReview,
  pullLessonForFix,
  toLaterReviewProblems,
} from "@zoonk/core/library/quality/later-reviews";
import { type PublishedLessonOutcome } from "@zoonk/core/library/quality/published-checks";
import { withAiRetry } from "../../_shared/ai-retry";

export type LaterReviewOutcome = { outcome: PublishedLessonOutcome; version: number } | null;

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

export async function pullLessonStep(lessonId: string): Promise<boolean> {
  "use step";

  return pullLessonForFix(lessonId);
}
