import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import {
  publishAlphabetFixStep,
  reviewAlphabetLessonStep,
  writeAlphabetFixStep,
} from "./steps/alphabet-review-steps";
import { setAsidePublishedLessonStep } from "./steps/lesson-check-steps";

type AlphabetReviewStatus = "passed" | "replaced" | "republished" | "setAside";

/**
 * A language's alphabet lesson is published before its review so its first learner doesn't wait;
 * a real error found here is fixed for the learners after them.
 */
export async function alphabetReviewWorkflow({
  analytics,
  lessonId,
}: {
  analytics?: ContentAnalytics;
  lessonId: string;
}): Promise<AlphabetReviewStatus> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const review = await reviewAlphabetLessonStep({ analytics, lessonId, workflowRunId });

  if (!review) {
    return "replaced";
  }

  if (review.problems.length === 0) {
    return "passed";
  }

  const fix = await writeAlphabetFixStep({ ...review, analytics, lessonId, workflowRunId });

  if (fix.status === "fixed") {
    const version = await publishAlphabetFixStep({
      lesson: fix.lesson,
      lessonId,
      provenance: fix.provenance,
      replaces: review.version,
    });

    return version === null ? "replaced" : "republished";
  }

  if (fix.status === "unfixed") {
    const setAside = await setAsidePublishedLessonStep({ lessonId, version: review.version });
    return setAside ? "setAside" : "replaced";
  }

  return "replaced";
}
