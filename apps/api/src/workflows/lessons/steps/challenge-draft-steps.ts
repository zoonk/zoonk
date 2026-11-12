import { createStepStream } from "@/workflows/_shared/stream-status";
import {
  type PlannedChallenge,
  type ScriptedChallenge,
  planChallenge,
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

export async function finishChallengeDraftStep({
  input,
  stage,
  scripted,
  problems,
  model,
}: {
  input: WriteInput;
  stage: ChallengeDraftStage;
  scripted?: ScriptedChallenge;
  problems: string[];
  model: string;
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

  if (problems.length > 0) {
    await holdBackChallengeLessonDraft({ ...input, model, problems });
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

  if (!scripted) {
    throw new Error("A challenge needs a checked script before publishing");
  }

  const saved = await publishChallengeLessonDraft({
    ...input,
    language: stage.params.language,
    scripted,
  });

  if (!saved) {
    return { status: "notWritten" };
  }

  await stream.status({ entityId: input.lessonId, status: "completed", step: "writeLesson" });
  return published;
}
