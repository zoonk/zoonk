import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  canRedraftLesson,
  getLessonGenerationState,
  isLessonSavedByRun,
} from "@zoonk/core/library/generation/state";
import {
  type LanguageLessonFix,
  type LessonProblem,
  fixLanguageLessonDraft,
  holdBackLanguageLessonDraft,
  reviewLanguageLessonDraft,
  reviewLanguageLessonFix,
} from "@zoonk/core/library/language/review-lesson";
import {
  type LanguageLessonDraft,
  publishLanguageLessonDraft,
} from "@zoonk/core/library/language/write-lesson-content";
import { type LessonStreamStep } from "./lesson-progress-step";
import {
  type LanguageDraftStage,
  type LessonWriteOutcome,
  type WriteInput,
} from "./write-lesson-content-step";

const PUBLISHED: LessonWriteOutcome = {
  check: null,
  imageScope: null,
  owesSentenceOrders: true,
  status: "published",
};

function toReviewContext({ analytics, draft, serviceTier }: LanguageDraftStage) {
  return { analytics, draft, serviceTier };
}

export async function reviewLanguageDraftStep(stage: LanguageDraftStage): Promise<LessonProblem[]> {
  "use step";

  return reviewLanguageLessonDraft(toReviewContext(stage));
}

export async function fixLanguageDraftStep({
  problems,
  stage,
}: {
  problems: LessonProblem[];
  stage: LanguageDraftStage;
}): Promise<LanguageLessonFix> {
  "use step";

  return fixLanguageLessonDraft({ ...toReviewContext(stage), problems, speed: stage.speed });
}

export async function reviewLanguageFixStep({
  fixed,
  flaggedScreens,
  stage,
}: {
  fixed: LanguageLessonDraft;
  flaggedScreens: (number | null)[];
  stage: LanguageDraftStage;
}): Promise<LessonProblem[]> {
  "use step";

  return reviewLanguageLessonFix({ ...toReviewContext(stage), fixed, flaggedScreens });
}

export async function publishLanguageDraftStep({
  draft,
  input,
}: {
  draft: LanguageLessonDraft;
  input: WriteInput;
}): Promise<LessonWriteOutcome> {
  "use step";

  // The runtime runs a step's body again when its result was lost after the body ended.
  if (await isLessonSavedByRun(input)) {
    return PUBLISHED;
  }

  const { lessonId, workflowRunId } = input;
  const saved = await publishLanguageLessonDraft({ draft, lessonId, workflowRunId });
  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: lessonId, status: "completed", step: "writeLesson" });
  return saved ? PUBLISHED : { status: "notWritten" };
}

export async function holdBackLanguageDraftStep({
  draft,
  input,
  problems,
}: {
  draft: LanguageLessonDraft;
  input: WriteInput;
  problems: LessonProblem[];
}): Promise<LessonWriteOutcome> {
  "use step";

  const { lessonId, workflowRunId } = input;
  await holdBackLanguageLessonDraft({ draft, lessonId, problems, workflowRunId });
  const state = await getLessonGenerationState(lessonId);
  return { redraft: canRedraftLesson(state), status: "heldBack" };
}
