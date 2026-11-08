import { type HeldBackDraft } from "@zoonk/core/library/generation/held-back-drafts";
import { type LessonCheckPlan } from "@zoonk/core/library/lessons/write-content";
import {
  type PublishedDraftOutcome,
  checkPublishedDraft,
  checkPublishedLesson,
  citePublishedLesson,
  fixPublishedDraft,
  publishFixedVersion,
  redraftPublishedLesson,
  stagePublishedDraft,
} from "@zoonk/core/library/quality/published-checks";
import { setAsidePublishedLesson } from "@zoonk/core/library/quality/set-aside";
import { prisma } from "@zoonk/db";
import { type ContentAnalytics } from "../../_shared/content-analytics";
import { type ImageScope, getImageScope } from "../../lessons/steps/write-lesson-content-step";

type CheckStepInput = {
  analytics?: ContentAnalytics;
  forExam?: boolean;
  lessonId: string;
  workflowRunId: string;
};

export async function checkPublishedLessonStep(
  input: CheckStepInput & { plan: LessonCheckPlan },
): Promise<PublishedDraftOutcome> {
  "use step";

  return checkPublishedLesson(input);
}

export async function redraftPublishedLessonStep(
  input: CheckStepInput & { heldBackDrafts: HeldBackDraft[]; version: number },
): Promise<PublishedDraftOutcome> {
  "use step";

  return redraftPublishedLesson(input);
}

export async function citePublishedLessonStep(
  input: CheckStepInput & { plan: Pick<LessonCheckPlan, "lesson" | "version"> },
): Promise<number> {
  "use step";

  return citePublishedLesson(input);
}

export async function setAsidePublishedLessonStep(input: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  "use step";

  return setAsidePublishedLesson(input);
}

export async function publishFixedVersionStep(input: {
  lessonId: string;
  version: number;
}): Promise<boolean> {
  "use step";

  return publishFixedVersion(input);
}

export async function readLessonImageScopeStep(lessonId: string): Promise<ImageScope> {
  "use step";

  const lesson = await prisma.lesson.findUnique({
    select: { owner: { select: { isAnonymous: true } }, ownerId: true },
    where: { id: lessonId },
  });

  return lesson ? getImageScope(lesson) : null;
}

export async function fixPublishedDraftStep(input: Parameters<typeof fixPublishedDraft>[0]) {
  "use step";
  return fixPublishedDraft(input);
}
export async function checkPublishedDraftStep(input: Parameters<typeof checkPublishedDraft>[0]) {
  "use step";
  return checkPublishedDraft(input);
}
export async function stagePublishedDraftStep(input: Parameters<typeof stagePublishedDraft>[0]) {
  "use step";
  return stagePublishedDraft(input);
}
