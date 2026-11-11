import { type LanguageLessonCheckPlan } from "@zoonk/core/library/language/write-lesson-content";
import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { startOnce } from "../_shared/run-token";
import {
  getSentenceOrdersToken,
  sentenceOrdersWorkflow,
} from "../language/sentence-orders-workflow";
import {
  publishLanguageLessonFixStep,
  reviewLanguageLessonFixStep,
  reviewLanguageLessonStep,
  writeLanguageLessonFixStep,
} from "./steps/language-review-steps";

type LanguageReviewStatus = "passed" | "replaced" | "republished" | "unchanged" | "unfixed";

/**
 * A language lesson is published before its review so the learner who asked for it doesn't wait;
 * an error found here is fixed by its writer for the learners after them. A fix that still has an
 * error leaves the published lesson as it is.
 */
export async function languageReviewWorkflow({
  analytics,
  lessonId,
  plan,
}: {
  analytics?: ContentAnalytics;
  lessonId: string;
  plan: LanguageLessonCheckPlan;
}): Promise<LanguageReviewStatus> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = { analytics, lessonId, plan, workflowRunId };
  const problems = await reviewLanguageLessonStep(context);

  if (!problems) {
    return "replaced";
  }

  if (problems.length === 0) {
    return "passed";
  }

  const fix = await writeLanguageLessonFixStep({ ...context, problems });

  if (fix.status !== "fixed") {
    return fix.status;
  }

  const remaining = await reviewLanguageLessonFixStep({
    ...context,
    fixed: fix.lesson,
    flaggedScreens: problems.map((problem) => problem.screen),
  });

  if (!remaining) {
    return "replaced";
  }

  if (remaining.length > 0) {
    return "unfixed";
  }

  const version = await publishLanguageLessonFixStep({
    lesson: fix.lesson,
    lessonId,
    plan,
    provenance: fix.provenance,
  });

  if (version === null) {
    return "replaced";
  }

  await startOnce(
    sentenceOrdersWorkflow,
    [{ analytics, lessonId, wait: "later" }],
    getSentenceOrdersToken(lessonId),
  );

  return "republished";
}
