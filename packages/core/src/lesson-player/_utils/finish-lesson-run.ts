import "server-only";
import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { finishExplanations } from "../../goals/_utils/finish-explanations";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { finishLessonChapters } from "../../mind-maps/finished-chapters";
import { clampEnergy } from "../../progress/energy";
import { completeLessonPlanItems, scheduleLessonCanDos } from "../../sessions/_utils/plan-items";
import { refitSessionLessons } from "../../sessions/_utils/refit-session-lessons";
import { trackBlockCompleted } from "../../sessions/_utils/session-events";
import { readBlockPayload } from "../../sessions/block-payload";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { upsertDailyProgress } from "../../stats/daily-progress";
import { finishLearningEvent } from "../../stats/record-learning-event";
import { type LessonRunTally } from "../lesson-run";
import { scoreLibraryLesson } from "../lesson-score";
import { recordSkippedWritingSteps } from "./completion-steps";
import { trackLessonCompleted } from "./lesson-events";
import { hasFinishedLessonBefore } from "./lesson-runs";
import { completeRunBlock, lockRunBlock } from "./lesson-study-block";
import { reviewLessonPlanSkills } from "./plan-skill-review";
import { getLessonCompletionSeconds } from "./session-lesson-duration";

type RunBlock = NonNullable<Awaited<ReturnType<typeof lockRunBlock>>>;

/** A finished block refits the session's lessons left, unless it was an extra or a reinforcement. */
async function refitAfterMainBlock(
  tx: TransactionClient,
  { block }: { block: RunBlock },
): Promise<void> {
  const payload = readBlockPayload(block);

  if (payload.extra || payload.reinforcement) {
    return;
  }

  await refitSessionLessons(tx, { completedBlockId: block.id, sessionId: block.sessionId });
}

/** Replays are reviews in the ledger and must not increment lessons completed. */
export async function finishLessonRun({
  answerPoints,
  answeredCount,
  answers,
  lessonId,
  planSkillIds,
  run,
  skippedWritingStepIds,
  tally,
  timeZone,
  userId,
}: {
  answerPoints: number;
  answeredCount: number;
  answers: Parameters<typeof reviewLessonPlanSkills>[0]["answers"];
  lessonId: string;
  planSkillIds: readonly string[];
  run: LearningEvent;
  skippedWritingStepIds: string[];
  tally: LessonRunTally;
  timeZone: string;
  userId: string;
}) {
  return writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const { completedAt, completionDate, currentEnergy } = await getCompletionEnergyContext({
      timeZone,
      transaction: tx,
      userId,
    });

    const isReplay = await hasFinishedLessonBefore(tx, { lessonId, runId: run.id, userId });
    const score = scoreLibraryLesson({ ...tally, answerPoints, isFirstCompletion: !isReplay });

    const currentRun = await tx.learningEvent.findUniqueOrThrow({ where: { id: run.id } });

    if (currentRun.endedAt) {
      return unchanged(null);
    }

    const block = await lockRunBlock({
      lessonId,
      now: completedAt,
      run: currentRun,
      timeZone,
      tx,
      userId,
    });

    const seconds = await getLessonCompletionSeconds({
      block,
      now: completedAt,
      run: currentRun,
      tx,
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
      return unchanged(null);
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

    const changed = await reviewLessonPlanSkills({
      answers,
      planSkillIds,
      reviewedAt: completedAt,
      timeZone,
      transaction: tx,
      userId,
    });

    const brainPower = {
      after: Number(progress.totalBrainPower),
      before: Number(progress.totalBrainPower) - score.brainPower,
    };

    const blockDone =
      block !== null &&
      (await completeRunBlock(tx, {
        block,
        brainPower,
        now: completedAt,
        run: currentRun,
        timeZone,
        userId,
      }));

    const { languageGoals, planItemIds } = await completeLessonPlanItems(tx, {
      lessonId,
      now: completedAt,
      userId,
    });

    await finishLessonChapters(tx, {
      eventId: run.id,
      goalId: block?.session.goalId ?? null,
      planItemIds,
      userId,
    });

    if (blockDone && block) {
      await refitAfterMainBlock(tx, { block });
    }

    const explanationsFinished = await finishExplanations(tx, { lessonId, userId });

    return {
      completedBlock: blockDone ? block : null,
      completion: {
        ...score,
        correctCount: tally.correctCount,
        incorrectCount: tally.incorrectCount,
        isFirstCompletion: !isReplay,
        seconds,
        totalBrainPower: Number(progress.totalBrainPower),
      },
      explanationsFinished,
      languageGoals,
      modelChanged: changed,
      progress: { brainPower, energy: { after: clampedEnergy, before: currentEnergy } },
    };
  });
}

type FinishedRun = Awaited<ReturnType<typeof finishLessonRun>>;

/** Call once the run's transaction committed, with its result (null when another request closed the run). */
export function announceFinishedRun({
  finished,
  lessonId,
  run,
  userId,
}: {
  finished: FinishedRun;
  lessonId: string;
  run: LearningEvent;
  userId: string;
}): void {
  revalidateCacheTags([
    getUserProgressCacheTag(userId),
    ...(finished?.modelChanged ? [getLearnerModelCacheTag(userId)] : []),
    ...(finished?.explanationsFinished
      ? [getGoalsCacheTag(userId), getLearningProfileCacheTag(userId)]
      : []),
  ]);

  if (!finished) {
    return;
  }

  scheduleLessonCanDos({ goals: finished.languageGoals, lessonId, userId });

  trackLessonCompleted({
    isFirstCompletion: finished.completion.isFirstCompletion,
    lessonId,
    run,
    seconds: finished.completion.seconds,
  });

  if (finished.completedBlock) {
    trackBlockCompleted({
      block: finished.completedBlock,
      seconds: finished.completion.seconds,
      session: finished.completedBlock.session,
    });
  }
}
