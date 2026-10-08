import { getWorkflowMetadata } from "workflow";
import { type LessonCheckStatus, settlePublishedLesson } from "./lesson-check-workflow";
import { reviewLessonLaterStep } from "./steps/later-review-steps";

export type LaterReviewResult = { replaced: string[]; reviewed: number; setAside: string[] };

/**
 * The later check of lessons made ahead of time: each lesson gets the lesson quality check at the
 * flex tier, from a reasoning model of another family than the writer. A lesson it finds something
 * wrong in gets a fresh draft, checked in full, published as its next version (learners playing
 * the current one finish it); when no draft passes, the lesson is taken out of play.
 */
export async function laterReviewWorkflow({
  lessonIds,
}: {
  lessonIds: string[];
}): Promise<LaterReviewResult> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const reviews = await Promise.allSettled(
    lessonIds.map((lessonId) => reviewLessonLaterStep({ lessonId, workflowRunId })),
  );

  const settled = await Promise.allSettled(
    lessonIds.map(async (lessonId, index): Promise<LessonCheckStatus | null> => {
      const review = reviews[index];

      if (
        review?.status !== "fulfilled" ||
        !review.value ||
        review.value.outcome.status !== "heldBack"
      ) {
        return null;
      }

      return settlePublishedLesson({
        context: { lessonId, workflowRunId },
        outcome: review.value.outcome,
        version: review.value.version,
      });
    }),
  );

  const withStatus = (status: LessonCheckStatus) =>
    lessonIds.filter((_, index) => {
      const result = settled[index];
      return result?.status === "fulfilled" && result.value === status;
    });

  return {
    replaced: withStatus("republished"),
    reviewed: reviews.filter((review) => review.status === "fulfilled" && review.value).length,
    setAside: withStatus("setAside"),
  };
}
