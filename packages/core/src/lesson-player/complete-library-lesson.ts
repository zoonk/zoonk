import "server-only";
import { type LearningEvent, prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag, getUserProgressCacheTag } from "../cache/tags";
import { getLearnerTimeZone } from "../learner/_utils/goal-time-zone";
import {
  loadLessonPlanSkillIds,
  loadLessonReviewSkillIds,
} from "../learner/_utils/lesson-plan-skills";
import { clampEnergy } from "../progress/energy";
import { scoreLessonAnswers } from "../sessions/score-lesson-answers";
import { getCompletionEnergyContext } from "../stats/completion-energy";
import { upsertDailyProgress } from "../stats/daily-progress";
import { finishLearningEvent } from "../stats/record-learning-event";
import { getSession } from "../users/get-session";
import { loadCompletionSteps, recordSkippedWritingSteps } from "./_utils/completion-steps";
import { trackLessonCompleted } from "./_utils/lesson-events";
import { isOwnExplanation } from "./_utils/lesson-rows";
import { findLessonRun, hasFinishedLessonBefore, toSittings } from "./_utils/lesson-runs";
import {
  type LessonProgress,
  type RunCompletion,
  withStudyBlock,
} from "./_utils/lesson-study-block";
import { loadPlayedLesson } from "./_utils/load-played-lesson";
import {
  getNextReviewAt,
  loadLessonAttempts,
  reviewFinishedLesson,
} from "./_utils/plan-skill-review";
import { getLessonCompletionSeconds } from "./_utils/session-lesson-duration";
import { type LibraryLessonCompletionInput } from "./completion-input-contract";
import { type LibraryLessonCompletion } from "./contract";
import { type LessonRunTally, tallyLessonRun } from "./lesson-run";
import { scoreLibraryLesson } from "./lesson-score";

export type LibraryLessonCompletionOutcome =
  | { completion: LibraryLessonCompletion; status: "completed" }
  | { status: "invalid" }
  | { status: "notFound" }
  | { status: "unauthorized" };

type CompletionRun = {
  lessonId: string;
  run: LearningEvent;
  skillIds: string[];
  timeZone: string;
  userId: string;
};

/** Retries must use the saved outcome without counting the run twice. */
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

/** Replays are reviews in the ledger and must not increment lessons completed. */
async function finishRun({
  answerPoints,
  answeredCount,
  answers,
  lessonId,
  planSkillIds,
  run,
  skillIds,
  skippedWritingStepIds,
  tally,
  timeZone,
  userId,
}: CompletionRun & {
  answerPoints: number;
  answeredCount: number;
  answers: Parameters<typeof reviewFinishedLesson>[0]["answers"];
  planSkillIds: readonly string[];
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

    const { changed, nextReviewAt } = await reviewFinishedLesson({
      answers,
      planSkillIds,
      reviewedAt: completedAt,
      skillIds,
      timeZone,
      transaction: tx,
      userId,
    });

    return {
      completion: {
        ...score,
        correctCount: tally.correctCount,
        incorrectCount: tally.incorrectCount,
        isFirstCompletion: !isReplay,
        nextReviewAt,
        seconds,
        totalBrainPower: Number(progress.totalBrainPower),
      },
      modelChanged: changed,
      progress: {
        brainPower: {
          after: Number(progress.totalBrainPower),
          before: Number(progress.totalBrainPower) - score.brainPower,
        },
        energy: { after: clampedEnergy, before: currentEnergy },
      },
    };
  });
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

  const settle = (completion: RunCompletion, progress?: LessonProgress) =>
    withStudyBlock({ completion, lessonId, progress, runId: run.id, timeZone, userId });

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

  // Resolve membership before taking progress/run locks; the transaction uses only its own client.
  const planSkillIds =
    skillIds.length > 0
      ? await loadLessonPlanSkillIds({ lessonIds: [lessonId], userId })
      : new Map<string, string[]>();

  const finished = await finishRun({
    answerPoints,
    answeredCount: attempts.length,
    answers: attempts,
    lessonId,
    planSkillIds: planSkillIds.get(lessonId) ?? [],
    run,
    skillIds,
    skippedWritingStepIds,
    tally,
    timeZone,
    userId,
  });

  revalidateCacheTags([
    getUserProgressCacheTag(userId),
    ...(finished?.modelChanged ? [getLearnerModelCacheTag(userId)] : []),
  ]);

  if (!finished) {
    const closedRun = await prisma.learningEvent.findUniqueOrThrow({ where: { id: run.id } });

    return {
      completion: await settle(await readFinishedRun({ run: closedRun, skillIds, userId })),
      status: "completed",
    };
  }

  trackLessonCompleted({
    isFirstCompletion: finished.completion.isFirstCompletion,
    lessonId,
    run,
    seconds: finished.completion.seconds,
  });

  return { completion: await settle(finished.completion, finished.progress), status: "completed" };
}
