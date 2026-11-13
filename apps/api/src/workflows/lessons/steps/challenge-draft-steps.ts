import { createStepStream } from "@/workflows/_shared/stream-status";
import { type ChallengeFinding } from "@zoonk/ai/tasks/quality/challenge-quality-check";
import {
  type ChallengeDraft,
  type PlannedChallenge,
  type ScriptedChallenge,
  fixChallenge,
  planChallenge,
  recheckChallenge,
  reviewChallenge,
  scriptChallenge,
} from "@zoonk/core/library/challenges/draft";
import {
  holdBackChallengeLessonDraft,
  publishChallengeLessonDraft,
} from "@zoonk/core/library/challenges/lesson-draft";
import {
  canRedraftLesson,
  getLessonGenerationState,
  isLessonSavedByRun,
} from "@zoonk/core/library/generation/state";
import { type LessonStreamStep } from "./lesson-progress-step";
import {
  type ChallengeDraftStage,
  type LessonWriteOutcome,
  type WriteInput,
} from "./write-lesson-content-step";

/** A field variant has no lesson, so no wait follows its steps. */
async function streamStep<T>({
  lessonId,
  run,
  step,
}: {
  lessonId?: string;
  run: () => Promise<T>;
  step: LessonStreamStep;
}): Promise<T> {
  if (!lessonId) {
    return run();
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: lessonId, status: "started", step });
  const result = await run();
  await stream.status({ entityId: lessonId, status: "completed", step });
  return result;
}

export async function planChallengeStep({
  lessonId,
  stage,
}: {
  lessonId?: string;
  stage: ChallengeDraftStage;
}) {
  "use step";

  return streamStep({ lessonId, run: () => planChallenge(stage.params), step: "planChallenge" });
}

export async function scriptChallengeStep({
  lessonId,
  stage,
  planned,
}: {
  lessonId?: string;
  stage: ChallengeDraftStage;
  planned: PlannedChallenge;
}) {
  "use step";

  return streamStep({
    lessonId,
    run: () => scriptChallenge({ params: stage.params, planned }),
    step: "writeChallenge",
  });
}

export async function reviewChallengeStep({
  lessonId,
  stage,
  scripted,
}: {
  lessonId?: string;
  stage: ChallengeDraftStage;
  scripted: ScriptedChallenge;
}) {
  "use step";

  return streamStep({
    lessonId,
    run: () => reviewChallenge({ params: stage.params, scripted }),
    step: "reviewChallenge",
  });
}

export async function fixChallengeStep({
  findings,
  lessonId,
  scripted,
  stage,
}: {
  findings: ChallengeFinding[];
  lessonId?: string;
  scripted: ScriptedChallenge;
  stage: ChallengeDraftStage;
}) {
  "use step";

  return streamStep({
    lessonId,
    run: () => fixChallenge({ findings, params: stage.params, scripted }),
    step: "fixChallenge",
  });
}

export async function recheckChallengeStep({
  fixed,
  lessonId,
  stage,
}: {
  fixed: ScriptedChallenge;
  lessonId?: string;
  stage: ChallengeDraftStage;
}) {
  "use step";

  return streamStep({
    lessonId,
    run: () => recheckChallenge({ fixed, params: stage.params }),
    step: "recheckChallenge",
  });
}

export async function finishChallengeDraftStep({
  draft,
  input,
  stage,
}: {
  draft: ChallengeDraft;
  input: WriteInput;
  stage: ChallengeDraftStage;
}): Promise<LessonWriteOutcome> {
  "use step";

  const published = {
    check: null,
    imageScope: null,
    owesSentenceOrders: false,
    status: "published",
  } as const;

  if (await isLessonSavedByRun(input)) {
    return published;
  }

  await using stream = createStepStream<LessonStreamStep>();

  if ("problems" in draft) {
    await holdBackChallengeLessonDraft({ ...input, model: draft.model, problems: draft.problems });
    const redraft = canRedraftLesson(await getLessonGenerationState(input.lessonId));

    if (redraft) {
      await stream.status({
        entityId: input.lessonId,
        status: "started",
        step: "redraftChallenge",
      });
    }

    return { redraft, status: "heldBack" };
  }

  const saved = await publishChallengeLessonDraft({
    ...input,
    language: stage.params.language,
    scripted: draft,
  });

  if (!saved) {
    return { status: "notWritten" };
  }

  await stream.status({ entityId: input.lessonId, status: "completed", step: "writeLesson" });
  return published;
}
