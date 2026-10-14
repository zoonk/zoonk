import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { getString } from "@zoonk/utils/json";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../cache/tags";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import { loadLessonReviewSkillIds } from "../learner/_utils/lesson-plan-skills";
import { clampEnergy } from "../progress/energy";
import { serializeStudyBlockCompletion } from "../sessions/completion-contract";
import { scoreLessonAnswers } from "../sessions/score-lesson-answers";
import { settleFinishedLesson } from "../sessions/settle-finished-lesson";
import { getCompletionEnergyContext } from "../stats/completion-energy";
import { upsertDailyProgress } from "../stats/daily-progress";
import { finishLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
import { loadCompletionSteps, recordSkippedWritingSteps } from "./_utils/completion-steps";
import { trackLessonCompleted } from "./_utils/lesson-events";
import { isOwnExplanation } from "./_utils/lesson-rows";
import { findLessonRun, hasFinishedLessonBefore, toSittings } from "./_utils/lesson-runs";
import { loadPlayedLesson } from "./_utils/load-played-lesson";
import { getNextReviewAt, reviewFinishedLesson } from "./_utils/plan-skill-review";
import { getLessonCompletionSeconds } from "./_utils/session-lesson-duration";
import { type LibraryLessonCompletionInput } from "./completion-input-contract";
import { type LibraryLessonCompletion, type PlayableLibraryStep } from "./contract";
import { type LessonRunTally, isAnswerableStep, tallyLessonRun } from "./lesson-run";
import { scoreLibraryLesson } from "./lesson-score";

export type LibraryLessonCompletionOutcome =
  | { completion: LibraryLessonCompletion; status: "completed" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

/** The run's own outcome; the session block's moment is added once the run is closed. */
type RunCompletion = Omit<LibraryLessonCompletion, "studyBlock">;

type CompletionRun = {
  lessonId: string;
  run: LearningEvent;
  /** The skills whose next review the completion announces. */
  skillIds: string[];
  timeZone: string;
  userId: string;
};

/**
 * A finished run keeps its outcome in the ledger, so repeating a completion (a retry, or a second
 * tab) returns the same result without counting anything twice.
 */
async function readFinishedRun({
  run,
  skillIds,
  userId,
}: Pick<CompletionRun, "run" | "skillIds" | "userId">): Promise<RunCompletion> {
  const [progress, nextReviewAt] = await Promise.all([
    prisma.userProgress.findUnique({ select: { totalBrainPower: true }, where: { userId } }),
    getNextReviewAt({ skillIds, userId }),
  ]);

  return {
    brainPower: run.brainPower,
    correctCount: run.correctAnswers,
    energyDelta: run.energyDelta,
    incorrectCount: run.incorrectAnswers,
    isFirstCompletion: run.kind === "lesson",
    nextReviewAt,
    seconds: run.seconds,
    totalBrainPower: Number(progress?.totalBrainPower ?? 0),
  };
}

/**
 * Closes the run and adds it to the learner's totals in one transaction. The learner's progress
 * lock serializes completions, and only an open run can close, so a run counts once. A replay is a
 * `review` in the ledger and doesn't add to the lessons completed that day.
 */
async function finishRun({
  answerPoints,
  answeredCount,
  lessonId,
  run,
  skippedWritingStepIds,
  tally,
  timeZone,
  userId,
}: Omit<CompletionRun, "skillIds"> & {
  answerPoints: number;
  answeredCount: number;
  skippedWritingStepIds: string[];
  tally: LessonRunTally;
}) {
  return prisma.$transaction(async (tx) => {
    const { completedAt, completionDate, currentEnergy } = await getCompletionEnergyContext({
      timeZone,
      transaction: tx,
      userId,
    });

    const isReplay = await hasFinishedLessonBefore(tx, { lessonId, runId: run.id, userId });
    const score = scoreLibraryLesson({ ...tally, answerPoints, isFirstCompletion: !isReplay });

    const currentRun = await tx.learningEvent.findUniqueOrThrow({ where: { id: run.id } });

    if (currentRun.endedAt) {
      return null;
    }

    const seconds = await getLessonCompletionSeconds({
      lessonId,
      now: completedAt,
      run: currentRun,
      timeZone,
      tx,
      userId,
    });

    const closed = await finishLearningEvent(tx, {
      endedAt: completedAt,
      eventId: run.id,
      kind: isReplay ? "review" : "lesson",
      outcome: {
        brainPower: score.brainPower,
        correctAnswers: tally.correctCount,
        energyDelta: score.energyDelta,
        incorrectAnswers: tally.incorrectCount,
        seconds,
      },
      timeZone,
    });

    if (!closed) {
      return null;
    }

    await recordSkippedWritingSteps({ run: currentRun, skippedWritingStepIds, tx });

    const clampedEnergy = clampEnergy(currentEnergy + score.energyDelta);

    const progress = await tx.userProgress.update({
      data: {
        currentEnergy: clampedEnergy,
        lastActiveAt: completedAt,
        totalBrainPower: { increment: score.brainPower },
      },
      where: { userId },
    });

    await upsertDailyProgress(tx, {
      clampedEnergy,
      date: completionDate,
      durationSeconds: seconds,
      field: answeredCount > 0 ? "interactiveCompleted" : "staticCompleted",
      lessonsCompleted: isReplay ? 0 : 1,
      score: {
        brainPower: score.brainPower,
        correctCount: tally.correctCount,
        incorrectCount: tally.incorrectCount,
      },
      userId,
    });

    return {
      ...score,
      correctCount: tally.correctCount,
      incorrectCount: tally.incorrectCount,
      isFirstCompletion: !isReplay,
      seconds,
      totalBrainPower: Number(progress.totalBrainPower),
    };
  });
}

/**
 * A finished lesson checks off its plan items and, when it was one of today's session blocks,
 * completes the block and settles the day; its moment rides along so the player needs no other
 * request. Repeating a completion returns the moment again.
 */
async function withStudyBlock({
  completion,
  lessonId,
  runId,
  timeZone,
  userId,
}: {
  completion: RunCompletion;
  lessonId: string;
  runId: string;
  timeZone: string;
  userId: string;
}): Promise<LibraryLessonCompletion> {
  const run = await prisma.learningEvent.findUniqueOrThrow({ where: { id: runId } });
  const blockId = getString(run.contentIds, "studySessionBlockId") ?? undefined;
  const studyBlock = await settleFinishedLesson({ blockId, lessonId, timeZone, userId });

  return {
    ...completion,
    studyBlock: studyBlock ? serializeStudyBlockCompletion(studyBlock) : null,
  };
}

/**
 * The answers the completion counts: every answerable screen's, since the first sitting the
 * learner left unfinished (this run's when there's none), with the sittings to score them by.
 */
async function loadLessonAttempts({
  sittings,
  steps,
  userId,
}: {
  sittings: Sittings;
  steps: Pick<PlayableLibraryStep, "id" | "kind">[];
  userId: string;
}) {
  const answerable = steps.filter((step) => isAnswerableStep(step)).map((step) => step.id);

  return prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: {
      answeredAt: true,
      id: true,
      isCorrect: true,
      itemId: true,
      skillId: true,
      stepId: true,
    },
    where: { answeredAt: { gte: sittings[0]?.startedAt }, stepId: { in: answerable }, userId },
  });
}

type Sittings = Awaited<ReturnType<typeof loadPlayedLesson>>["sittings"];

/**
 * The run's sittings (see `loadProgressRuns`) and the lesson as the learner played it: the
 * version they opened, which a check may have replaced since (`findOpenedVersion`).
 */
/**
 * Finishes a run of a Library lesson for the learner or guest in the session. The server
 * re-validates it from the answers it graded: every screen that takes an answer was answered in
 * this run or in an earlier sitting the learner left unfinished (see `loadProgressRuns`), or "I
 * know this" got every check right. A question whose numbered picture came too late for this run
 * is optional (`getLatePictureStepIds`). Then the ledger row closes, and Brain Power,
 * Energy and the day's totals are added. Completing the same run again returns the same result;
 * only the completion that closed the run counts as "Lesson Completed".
 */
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

  const { lesson, sittings, skippedWritingStepIds } = run
    ? await loadPlayedLesson({
        lessonId,
        run,
        skippedWritingStepIds: input.skippedWritingStepIds,
        userId,
      })
    : { lesson: null, sittings: [], skippedWritingStepIds: [] };

  if (!lesson || !run) {
    return { status: "notFound" };
  }

  const completionSteps = await loadCompletionSteps({
    lesson,
    runStartedAt: run.startedAt,
    skippedWritingStepIds,
    userId,
  });

  if (!completionSteps) {
    return { status: "invalid" };
  }

  // A quick explanation never comes back in a review (reviews come with a study plan's sessions,
  // which explanations aren't part of), so its completion announces none.
  const [skillIds, timeZone] = await Promise.all([
    isOwnExplanation(lesson)
      ? []
      : loadLessonReviewSkillIds({
          lessonId,
          ownSkillIds: [
            ...new Set([
              ...lesson.skills.map((skill) => skill.skillId),
              ...completionSteps.steps.flatMap((step) => (step.skillId ? [step.skillId] : [])),
            ]),
          ],
          userId,
        }),
    getLearnerTimeZone({ timeZone: input.timeZone, userId }),
  ]);

  const settle = (completion: RunCompletion) =>
    withStudyBlock({ completion, lessonId, runId: run.id, timeZone, userId });

  if (run.endedAt) {
    return {
      completion: await settle(await readFinishedRun({ run, skillIds, userId })),
      status: "completed",
    };
  }

  const attempts = await loadLessonAttempts({ sittings, steps: completionSteps.steps, userId });

  const tally = tallyLessonRun({
    attempts,
    optionalStepIds: completionSteps.optionalStepIds,
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

  const finished = await finishRun({
    answerPoints,
    answeredCount: attempts.length,
    lessonId,
    run,
    skippedWritingStepIds,
    tally,
    timeZone,
    userId,
  });

  revalidateCacheTags([getUserProgressCacheTag(userId)]);

  if (!finished) {
    const closedRun = await prisma.learningEvent.findUniqueOrThrow({ where: { id: run.id } });

    return {
      completion: await settle(await readFinishedRun({ run: closedRun, skillIds, userId })),
      status: "completed",
    };
  }

  trackLessonCompleted({
    isFirstCompletion: finished.isFirstCompletion,
    lessonId,
    run,
    seconds: finished.seconds,
  });

  const nextReviewAt = await reviewFinishedLesson({
    answers: attempts,
    lessonId,
    skillIds,
    timeZone,
    userId,
  });

  return { completion: await settle({ ...finished, nextReviewAt }), status: "completed" };
}
