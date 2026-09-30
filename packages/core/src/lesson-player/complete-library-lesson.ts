import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getUserProgressCacheTag } from "../cache/tags";
import { filterSkippedSteps } from "../language/activities/language-activities";
import { loadSkippedActivities } from "../language/activities/skipped-activities";
import { getAnswerTimeZone } from "../learner/_utils/owned-goal";
import { getCappedLessonDurationSeconds } from "../player/contracts/completion-duration";
import { clampEnergy } from "../progress/energy";
import { serializeStudyBlockCompletion } from "../sessions/completion-contract";
import { scoreLessonAnswers } from "../sessions/score-lesson-answers";
import { settleFinishedLesson } from "../sessions/settle-finished-lesson";
import { getCompletionEnergyContext } from "../stats/completion-energy";
import { upsertDailyProgress } from "../stats/daily-progress";
import { finishLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
import { trackLessonCompleted } from "./_utils/lesson-events";
import { findPlayableLessonRow } from "./_utils/lesson-rows";
import { findLessonRun, getRunStudySessionId, hasFinishedLessonBefore } from "./_utils/lesson-runs";
import { loadPlayableSteps } from "./_utils/load-playable-steps";
import { type LibraryLessonCompletion, type LibraryLessonCompletionInput } from "./contract";
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
  skillIds: string[];
  timeZone: string;
  userId: string;
};

/** The earliest review of the lesson's skills, which the completion moment announces. */
async function getNextReviewAt({ skillIds, userId }: { skillIds: string[]; userId: string }) {
  const next = await prisma.learnerSkill.findFirst({
    orderBy: { due: "asc" },
    select: { due: true },
    where: { due: { not: null }, skillId: { in: skillIds }, userId },
  });

  return next?.due?.toISOString() ?? null;
}

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
  tally,
  timeZone,
  userId,
}: Omit<CompletionRun, "skillIds"> & {
  answerPoints: number;
  answeredCount: number;
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

    const seconds = getCappedLessonDurationSeconds({
      now: completedAt.getTime(),
      startedAt: run.startedAt.getTime(),
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
  timeZone,
  userId,
}: {
  completion: RunCompletion;
  lessonId: string;
  timeZone: string;
  userId: string;
}): Promise<LibraryLessonCompletion> {
  const studyBlock = await settleFinishedLesson({ lessonId, timeZone, userId });

  return {
    ...completion,
    studyBlock: studyBlock ? serializeStudyBlockCompletion(studyBlock) : null,
  };
}

/**
 * Finishes a run of a Library lesson for the learner or guest in the session. The server
 * re-validates it from the answers it graded: every screen that takes an answer was answered in
 * this run, or "I know this" got every check right. Then the ledger row closes, and Brain Power,
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

  const [lesson, run] = await Promise.all([
    findPlayableLessonRow({ lessonId, userId }),
    findLessonRun({ lessonId, runId: input.runId, userId }),
  ]);

  if (!lesson || !run) {
    return { status: "notFound" };
  }

  const [allSteps, skippedActivities] = await Promise.all([
    loadPlayableSteps({ lesson, rows: lesson.steps }),
    lesson.targetLanguage
      ? loadSkippedActivities({ targetLanguage: lesson.targetLanguage, userId })
      : [],
  ]);

  // A language lesson finishes without the practice the learner left out of their plan.
  const steps = filterSkippedSteps({ activities: skippedActivities, steps: allSteps });

  const skillIds = [
    ...new Set([
      ...lesson.skills.map((skill) => skill.skillId),
      ...steps.flatMap((step) => (step.skillId ? [step.skillId] : [])),
    ]),
  ];

  const timeZone = getAnswerTimeZone({ goal: null, timeZone: input.timeZone });

  const settle = (completion: RunCompletion) =>
    withStudyBlock({ completion, lessonId, timeZone, userId });

  if (run.endedAt) {
    return {
      completion: await settle(await readFinishedRun({ run, skillIds, userId })),
      status: "completed",
    };
  }

  const answerable = steps.filter((step) => isAnswerableStep(step)).map((step) => step.id);

  const attempts = await prisma.attempt.findMany({
    orderBy: { answeredAt: "asc" },
    select: { answeredAt: true, id: true, isCorrect: true, itemId: true, stepId: true },
    where: { answeredAt: { gte: run.startedAt }, stepId: { in: answerable }, userId },
  });

  const tally = tallyLessonRun({ attempts, steps });

  if (!tally.isComplete) {
    return { status: "invalid" };
  }

  const { brainPower: answerPoints } = await scoreLessonAnswers({
    answers: attempts,
    studySessionId: getRunStudySessionId(run),
    userId,
  });

  const finished = await finishRun({
    answerPoints,
    answeredCount: attempts.length,
    lessonId,
    run,
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

  const nextReviewAt = await getNextReviewAt({ skillIds, userId });

  return { completion: await settle({ ...finished, nextReviewAt }), status: "completed" };
}
