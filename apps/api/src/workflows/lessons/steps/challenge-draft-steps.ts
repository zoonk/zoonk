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

export async function planChallengeStep(stage: ChallengeDraftStage) {
  "use step";
  return planChallenge(stage.params);
}

export async function scriptChallengeStep({
  stage,
  planned,
}: {
  stage: ChallengeDraftStage;
  planned: PlannedChallenge;
}) {
  "use step";
  return scriptChallenge({ params: stage.params, planned });
}

export async function reviewChallengeStep({
  stage,
  scripted,
}: {
  stage: ChallengeDraftStage;
  scripted: ScriptedChallenge;
}) {
  "use step";
  return reviewChallenge({ params: stage.params, scripted });
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

  if (problems.length > 0) {
    await holdBackChallengeLessonDraft({ ...input, model, problems });
  } else if (scripted) {
    const saved = await publishChallengeLessonDraft({
      ...input,
      language: stage.params.language,
      scripted,
    });

    if (!saved) {
      return { status: "notWritten" };
    }
  } else {
    throw new Error("A challenge needs a checked script before publishing");
  }

  await using stream = createStepStream<LessonStreamStep>();
  await stream.status({ entityId: input.lessonId, status: "completed", step: "writeLesson" });

  return problems.length === 0
    ? published
    : {
        redraft: canRedraftLesson(await getLessonGenerationState(input.lessonId)),
        status: "heldBack",
      };
}
