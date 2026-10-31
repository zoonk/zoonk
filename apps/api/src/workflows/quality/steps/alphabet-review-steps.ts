import {
  type AlphabetFix,
  type AlphabetReview,
  publishAlphabetFix,
  reviewAlphabetLesson,
  writeAlphabetFix,
} from "@zoonk/core/library/language/review-alphabet-lesson";
import { type ContentAnalytics } from "../../_shared/content-analytics";

type ReviewStepInput = { analytics?: ContentAnalytics; lessonId: string; workflowRunId: string };

export async function reviewAlphabetLessonStep(
  input: ReviewStepInput,
): Promise<AlphabetReview | null> {
  "use step";

  return reviewAlphabetLesson(input);
}

export async function writeAlphabetFixStep(
  input: ReviewStepInput & AlphabetReview,
): Promise<AlphabetFix> {
  "use step";

  return writeAlphabetFix(input);
}

export async function publishAlphabetFixStep(
  input: Parameters<typeof publishAlphabetFix>[0],
): Promise<number | null> {
  "use step";

  return publishAlphabetFix(input);
}
