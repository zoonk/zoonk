import { getWorkflowMetadata } from "workflow";
import { type ContentAnalytics } from "../_shared/content-analytics";
import { voiceAlphabetClips } from "../language/alphabet-lesson";
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
  version,
}: {
  analytics?: ContentAnalytics;
  lessonId: string;
  version: number;
}): Promise<AlphabetReviewStatus> {
  "use workflow";

  const { workflowRunId } = getWorkflowMetadata();
  const context = { analytics, lessonId, version, workflowRunId };
  const problems = await reviewAlphabetLessonStep(context);

  if (!problems) {
    return "replaced";
  }

  if (problems.length === 0) {
    return "passed";
  }

  const fix = await writeAlphabetFixStep({ ...context, problems });

  if (fix.status === "unfixed") {
    const setAside = await setAsidePublishedLessonStep({ lessonId, version });
    return setAside ? "setAside" : "replaced";
  }

  if (fix.status !== "fixed") {
    return "replaced";
  }

  const audioUrls = await voiceAlphabetClips({
    clips: fix.clips,
    targetLanguage: fix.targetLanguage,
  });

  const published = await publishAlphabetFixStep({
    audioUrls,
    lesson: fix.lesson,
    lessonId,
    provenance: fix.provenance,
    replaces: version,
  });

  return published === null ? "replaced" : "republished";
}
