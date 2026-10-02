import { getWorkflowMetadata } from "workflow";
import { start } from "workflow/api";
import { lessonContentWorkflow } from "../lessons/lesson-content-workflow";
import { pullLessonStep, reviewLessonLaterStep } from "./steps/later-review-steps";

type Review = PromiseSettledResult<boolean | null>;

/** A review that couldn't run (its step failed, or the lesson can't be reviewed) pulls nothing. */
function foundProblem(review: Review | undefined): boolean {
  return review?.status === "fulfilled" && review.value === true;
}

function wasReviewed(review: Review): boolean {
  return review.status === "fulfilled" && review.value !== null;
}

/**
 * The later check of lessons made ahead of time: each lesson gets the lesson quality check at the
 * flex tier, from a reasoning model of another family than the writer. A lesson with a blocking problem is pulled (nobody opened it yet, so nobody loses
 * progress) and written again, with the reasoning check required before it's published.
 */
export async function laterReviewWorkflow({
  lessonIds,
}: {
  lessonIds: string[];
}): Promise<{ pulled: string[]; reviewed: number }> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();

  const reviews = await Promise.allSettled(
    lessonIds.map((lessonId) => reviewLessonLaterStep({ lessonId, workflowRunId })),
  );

  const failed = lessonIds.filter((_, index) => foundProblem(reviews[index]));

  const pulled = await Promise.all(
    failed.map(async (lessonId) => ((await pullLessonStep(lessonId)) ? [lessonId] : [])),
  );

  const pulledIds = pulled.flat();

  await Promise.all(
    pulledIds.map((lessonId) => start(lessonContentWorkflow, [{ forceReview: true, lessonId }])),
  );

  return { pulled: pulledIds, reviewed: reviews.filter((review) => wasReviewed(review)).length };
}
