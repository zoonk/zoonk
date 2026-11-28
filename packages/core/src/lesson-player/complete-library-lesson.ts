import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { loadLessonPlanSkillIds } from "../learner/_utils/lesson-plan-skills";
import { scoreLessonAnswers } from "../sessions/score-lesson-answers";
import { getSession } from "../users/get-session";
import { findOptionalStepIds, loadCompletionSteps } from "./_utils/completion-steps";
import { announceFinishedRun, finishLessonRun } from "./_utils/finish-lesson-run";
import { isOwnExplanation } from "./_utils/lesson-rows";
import { findLessonRun, toSittings } from "./_utils/lesson-runs";
import {
  type LessonProgress,
  type RunCompletion,
  withStudyBlock,
} from "./_utils/lesson-study-block";
import { loadPlayedLesson } from "./_utils/load-played-lesson";
import { findOwedPlanReveal } from "./_utils/owed-plan-reveal";
import { loadLessonAttempts } from "./_utils/plan-skill-review";
import { type LibraryLessonCompletionInput } from "./completion-input-contract";
import { type LibraryLessonCompletion, lessonPlacementOfferSchema } from "./contract";
import { tallyLessonRun } from "./lesson-run";

export type LibraryLessonCompletionOutcome =
  | { completion: LibraryLessonCompletion; status: "completed" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** Retries must use the saved outcome without counting the run twice. */
async function readFinishedRun({
  run,
  userId,
}: {
  run: LearningEvent;
  userId: string;
}): Promise<RunCompletion> {
  const progress = await prisma.userProgress.findUnique({
    select: { totalBrainPower: true },
    where: { userId },
  });

  return {
    brainPower: run.brainPower,
    correctCount: run.correctAnswers,
    energyDelta: run.energyDelta,
    incorrectCount: run.incorrectAnswers,
    isFirstCompletion: run.kind === "lesson",
    seconds: run.seconds,
    totalBrainPower: Number(progress?.totalBrainPower ?? 0),
  };
}

async function dismissOffer({ runId, userId }: { runId: string; userId: string }): Promise<void> {
  await prisma.$executeRaw`
      UPDATE learning_events
      SET content_ids = content_ids - 'placementOffer'
      WHERE id = ${runId}::uuid AND user_id = ${userId}::uuid
        AND content_ids ? 'placementOffer'
    `;
}

function readOffer(run: LearningEvent) {
  return isJsonObject(run.contentIds)
    ? lessonPlacementOfferSchema.safeParse(run.contentIds.placementOffer).data
    : undefined;
}

async function prepareCompletion({
  input,
  lessonId,
  run,
  userId,
}: {
  input: LibraryLessonCompletionInput;
  lessonId: string;
  run: LearningEvent;
  userId: string;
}) {
  if (input.dismissPlacementOffer) {
    if (!run.endedAt) {
      return { status: "invalid" as const };
    }

    await dismissOffer({ runId: run.id, userId });
  }

  const { lesson, sittings, skippedWritingStepIds } = await loadPlayedLesson({
    lessonId,
    run,
    skippedWritingStepIds: input.skippedWritingStepIds,
    userId,
  });

  if (!lesson) {
    return { status: "notFound" as const };
  }

  const completionSteps = await loadCompletionSteps({
    lesson,
    runStartedAt: run.startedAt,
    skippedWritingStepIds,
    userId,
  });

  return completionSteps
    ? { completionSteps, lesson, sittings, skippedWritingStepIds, status: "ready" as const }
    : { status: "invalid" as const };
}

/** Requires all answerable screens completed or a valid skip; late numbered-picture screens are optional. Retries return the saved outcome without recounting. */
export async function completeLibraryLesson({
  input,
  lessonId,
}: {
  input: LibraryLessonCompletionInput;
  lessonId: string;
}): Promise<LibraryLessonCompletionOutcome> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (!isUuid(lessonId) || !isUuid(input.runId)) {
    return { status: "notFound" };
  }

  const userId = session.user.id;

  const run = await findLessonRun({ lessonId, runId: input.runId, userId });

  if (!run) {
    return { status: "notFound" };
  }

  const ready = await prepareCompletion({ input, lessonId, run, userId });

  if (ready.status !== "ready") {
    return ready;
  }

  const { completionSteps, lesson, sittings, skippedWritingStepIds } = ready;
  const timeZone = await getLearnerTimeZone({ timeZone: input.timeZone, userId });

  const settle = async (
    completion: RunCompletion,
    progress?: LessonProgress,
    placementOffer?: LibraryLessonCompletion["placementOffer"],
  ): Promise<LibraryLessonCompletion> => {
    const [settled, planReveal] = await Promise.all([
      withStudyBlock({ completion, progress, runId: run.id, timeZone, userId }),
      findOwedPlanReveal({ lessonId, userId }),
    ]);

    return { ...settled, ...(placementOffer && { placementOffer }), planReveal };
  };

  if (run.endedAt) {
    return {
      completion: await settle(
        await readFinishedRun({ run, userId }),
        undefined,
        input.dismissPlacementOffer ? undefined : readOffer(run),
      ),
      status: "completed",
    };
  }

  const attempts = await loadLessonAttempts({ sittings, steps: completionSteps.steps, userId });

  const tally = tallyLessonRun({
    attempts,
    optionalStepIds: findOptionalStepIds({ answers: attempts, completionSteps }),
    steps: completionSteps.steps,
  });

  if (!tally.isComplete) {
    return { status: "invalid" };
  }

  const { brainPower: answerPoints } = await scoreLessonAnswers({
    answers: attempts,
    sittings: toSittings(sittings),
    userId,
  });

  // Resolve membership before taking progress/run locks; the transaction uses only its own client.
  const heldSkillIds = isOwnExplanation(lesson)
    ? new Map<string, string[]>()
    : await loadLessonPlanSkillIds({ lessonIds: [lessonId], userId });

  const finished = await finishLessonRun({
    answerPoints,
    answeredCount: attempts.length,
    answers: attempts,
    identityKey: lesson.identityKey,
    lessonId,
    planSkillIds: heldSkillIds.get(lessonId) ?? [],
    run,
    skippedWritingStepIds,
    tally,
    teachingSkillIds: lesson.skills.map(({ skillId }) => skillId),
    timeZone,
    userId,
  });

  announceFinishedRun({ finished, lessonId, run, userId });

  if (!finished) {
    const closedRun = await prisma.learningEvent.findUniqueOrThrow({ where: { id: run.id } });

    return {
      completion: await settle(
        await readFinishedRun({ run: closedRun, userId }),
        undefined,
        readOffer(closedRun),
      ),
      status: "completed",
    };
  }

  return {
    completion: await settle(
      finished.completion,
      finished.progress,
      finished.placementOffer ?? undefined,
    ),
    status: "completed",
  };
}
