import "server-only";
import { type LearningEvent, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getLearningProfileCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { finishExplanations } from "../../goals/_utils/finish-explanations";
import { loadSkillSurvivors } from "../../learner/_utils/update-learner-skill";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { getSecondTakeSkillId } from "../../library/second-takes/second-take-identity";
import { finishLessonChapters } from "../../mind-maps/finished-chapters";
import { clampEnergy } from "../../progress/energy";
import {
  type CompletedLessonItems,
  completeLessonPlanItems,
  scheduleLessonCanDos,
} from "../../sessions/_utils/plan-items";
import { refitSessionLessons } from "../../sessions/_utils/refit-session-lessons";
import { trackBlockCompleted } from "../../sessions/_utils/session-events";
import { type BlockPayload, readBlockPayload } from "../../sessions/block-payload";
import { isOutsidePlanLesson } from "../../sessions/day-block";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { upsertDailyProgress } from "../../stats/daily-progress";
import { finishLearningEvent } from "../../stats/record-learning-event";
import { lessonPlacementOfferSchema } from "../contract";
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

  if (payload.extra || isOutsidePlanLesson(payload)) {
    return;
  }

  await refitSessionLessons(tx, { completedBlockId: block.id, sessionId: block.sessionId });
}

/** A lesson served another way teaches only the stuck skill it was chosen for. */
function getTaughtSkillIds({
  payload,
  secondTakeSkillId,
  teachingSkillIds,
}: {
  payload: BlockPayload | null;
  secondTakeSkillId: string | null;
  teachingSkillIds: readonly string[];
}): readonly string[] {
  if (secondTakeSkillId) {
    return [secondTakeSkillId];
  }

  return payload?.returning === "anotherWay" ? payload.skillIds : teachingSkillIds;
}

/** Replays, second takes and lessons Today brings back move the evidence cutoff; another first finish sets only a missing one. */
async function markTeachingBoundary({
  block,
  completedAt,
  isReview,
  secondTakeSkillId,
  teachingSkillIds,
  tx,
  userId,
}: {
  block: RunBlock | null;
  completedAt: Date;
  isReview: boolean;
  secondTakeSkillId: string | null;
  teachingSkillIds: readonly string[];
  tx: TransactionClient;
  userId: string;
}) {
  const payload = block ? readBlockPayload(block) : null;
  const refresh = isReview || Boolean(payload?.returning);
  const skillIds = getTaughtSkillIds({ payload, secondTakeSkillId, teachingSkillIds });

  if (skillIds.length === 0) {
    return;
  }

  const survivor = await loadSkillSurvivors(skillIds, tx);
  const skills = [...new Set(skillIds.map((skillId) => survivor(skillId)))];

  await tx.learnerSkill.createMany({
    data: skills.map((skillId) => ({ helpedAt: completedAt, skillId, userId })),
    skipDuplicates: true,
  });

  await tx.learnerSkill.updateMany({
    data: { helpedAt: completedAt },
    where: {
      OR: [{ helpedAt: null }, ...(refresh ? [{ helpedAt: { lt: completedAt } }] : [])],
      skillId: { in: skills },
      userId,
    },
  });
}

type FinishLessonRunInput = {
  answerPoints: number;
  answeredCount: number;
  answers: Parameters<typeof reviewLessonPlanSkills>[0]["answers"];
  identityKey: string;
  lessonId: string;
  planSkillIds: readonly string[];
  run: LearningEvent;
  skippedWritingStepIds: string[];
  tally: LessonRunTally;
  teachingSkillIds: readonly string[];
  timeZone: string;
  userId: string;
};

/** Replays are reviews in the ledger and must not increment lessons completed. */
export async function finishLessonRun({
  answerPoints,
  answeredCount,
  answers,
  identityKey,
  lessonId,
  planSkillIds,
  run,
  skippedWritingStepIds,
  tally,
  teachingSkillIds,
  timeZone,
  userId,
}: FinishLessonRunInput) {
  return writeLearnerChange({ planInputs: true, userId }, async (tx) => {
    const { completedAt, completionDate, currentEnergy } = await getCompletionEnergyContext({
      timeZone,
      transaction: tx,
      userId,
    });

    const isReplay = await hasFinishedLessonBefore(tx, { lessonId, runId: run.id, userId });

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

    const secondTakeSkillId = getSecondTakeSkillId(identityKey);
    const isFirstCompletion = !isReplay;
    const isReview = isReplay || secondTakeSkillId !== null;

    const score = scoreLibraryLesson({ ...tally, answerPoints, isFirstCompletion });

    const seconds = await getLessonCompletionSeconds({
      block,
      now: completedAt,
      run: currentRun,
      tx,
    });

    const closed = await finishLearningEvent(tx, {
      endedAt: completedAt,
      eventId: run.id,
      kind: isReview ? "review" : "lesson",
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

    await markTeachingBoundary({
      block,
      completedAt,
      isReview,
      secondTakeSkillId,
      teachingSkillIds,
      tx,
      userId,
    });

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
      lessonsCompleted: Number(!isReview),
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

    const replaysOutsidePlan =
      isReplay && block !== null && isOutsidePlanLesson(readBlockPayload(block));

    const { languageGoals, planItemIds }: CompletedLessonItems =
      secondTakeSkillId || replaysOutsidePlan
        ? { languageGoals: [], planItemIds: [] }
        : await completeLessonPlanItems(tx, { lessonId, now: completedAt, userId });

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
        isFirstCompletion,
        seconds,
        totalBrainPower: Number(progress.totalBrainPower),
      },
      explanationsFinished,
      languageGoals,
      modelChanged: changed,
      placementOffer: isJsonObject(currentRun.contentIds)
        ? lessonPlacementOfferSchema.safeParse(currentRun.contentIds.placementOffer).data
        : undefined,
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
