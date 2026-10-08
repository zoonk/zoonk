import { type HeldBackDraft } from "@zoonk/core/library/generation/held-back-drafts";
import { type LessonCheckPlan } from "@zoonk/core/library/lessons/write-content";
import {
  type PublishedLessonOutcome,
  checkPublishedLesson,
  citePublishedLesson,
  redraftPublishedLesson,
  setAsidePublishedLesson,
} from "@zoonk/core/library/quality/published-checks";
import { prisma } from "@zoonk/db";
import { withAiRetry } from "../../_shared/ai-retry";
import { type ContentAnalytics } from "../../_shared/content-analytics";
import { type ImageScope, getImageScope } from "../../lessons/steps/write-lesson-content-step";

type CheckStepInput = {
  analytics?: ContentAnalytics;
  forExam?: boolean;
  lessonId: string;
  workflowRunId: string;
};

/**
 * The reasoning check of a version learners already play, at flex, and one fix pass published as
 * the next version when it finds something (see `checkPublishedLesson`).
 */
export async function checkPublishedLessonStep(
  input: CheckStepInput & { plan: LessonCheckPlan },
): Promise<PublishedLessonOutcome> {
  "use step";

  return withAiRetry(() => checkPublishedLesson(input));
}

/** A fresh draft in place of a published version no fix put right (see `redraftPublishedLesson`). */
export async function redraftPublishedLessonStep(
  input: CheckStepInput & { heldBackDrafts: HeldBackDraft[]; version: number },
): Promise<PublishedLessonOutcome> {
  "use step";

  return withAiRetry(() => redraftPublishedLesson(input));
}

redraftPublishedLessonStep.maxRetries = 1;

/** Citations for a version written from documents, after it's published. */
export async function citePublishedLessonStep(
  input: CheckStepInput & { plan: Pick<LessonCheckPlan, "lesson" | "version"> },
): Promise<number> {
  "use step";

  return withAiRetry(() => citePublishedLesson(input));
}

/** Takes a lesson whose live version is wrong and that no draft could replace out of play. */
export async function setAsidePublishedLessonStep(input: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  "use step";

  return setAsidePublishedLesson(input);
}

/** Whose pictures a lesson's new version gets (see `getImageScope`). */
export async function readLessonImageScopeStep(lessonId: string): Promise<ImageScope> {
  "use step";

  const lesson = await prisma.lesson.findUnique({
    select: { owner: { select: { isAnonymous: true } }, ownerId: true },
    where: { id: lessonId },
  });

  return lesson ? getImageScope(lesson) : null;
}
