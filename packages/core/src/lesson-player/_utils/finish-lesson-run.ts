import "server-only";
import { type LearningEvent } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { finishExplanations } from "../../goals/_utils/finish-explanations";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { clampEnergy } from "../../progress/energy";
import { completeLessonPlanItems, scheduleLessonCanDos } from "../../sessions/_utils/plan-items";
import { trackBlockCompleted } from "../../sessions/_utils/session-events";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { upsertDailyProgress } from "../../stats/daily-progress";
import { finishLearningEvent } from "../../stats/record-learning-event";
import { type LessonRunTally } from "../lesson-run";
import { scoreLibraryLesson } from "../lesson-score";
import { recordSkippedWritingSteps } from "./completion-steps";
import { trackLessonCompleted } from "./lesson-events";
import { hasFinishedLessonBefore } from "./lesson-runs";
import { completeRunBlock, lockRunBlock } from "./lesson-study-block";
import { reviewFinishedLesson } from "./plan-skill-review";
import { getLessonCompletionSeconds } from "./session-lesson-duration";

/** Replays are reviews in the ledger and must not increment lessons completed. */
export async function finishLessonRun({
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
}: {
  answerPoints: number;
  answeredCount: number;
  answers: Parameters<typeof reviewFinishedLesson>[0]["answers"];
  lessonId: string;
  planSkillIds: readonly string[];
  run: LearningEvent;
  skillIds: string[];
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

    const { changed, nextReviewAt } = await reviewFinishedLesson({
      answers,
      planSkillIds,
      reviewedAt: completedAt,
      skillIds,
      timeZone,
      transaction: tx,
      userId,
    });

    const languageGoals = await completeLessonPlanItems(tx, { lessonId, now: completedAt, userId });

    const blockDone =
      block !== null &&
      (await completeRunBlock(tx, {
        block,
        brainPower: score.brainPower,
        now: completedAt,
        run: currentRun,
        timeZone,
        userId,
      }));

    const explanationsFinished = await finishExplanations(tx, { lessonId, userId });

    return {
      completedBlock: blockDone ? block : null,
      completion: {
        ...score,
        correctCount: tally.correctCount,
        incorrectCount: tally.incorrectCount,
        isFirstCompletion: !isReplay,
        nextReviewAt,
        seconds,
        totalBrainPower: Number(progress.totalBrainPower),
      },
      explanationsFinished,
      languageGoals,
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
