import { type LanguageSkill, type TransactionClient } from "@zoonk/db";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
import "server-only";
import { isJsonObject } from "@zoonk/utils/json";
import { trackLearnerEvents } from "../../analytics/track-learner-event";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { owePlanStartLessons } from "../../follow-ups/owe-goal-lessons";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { levelTestReceipt } from "../../plans/_utils/test-out-receipt";
import { recordTestOutChange } from "../../plans/record-test-out-change";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { readGoalDetails } from "../_utils/language-goal";
import { getLevelTestEnd } from "./_utils/level-test-end";
import { skipConfirmedLanguageLessons } from "./_utils/level-test-placement";
import { getLevelTestPlanningStart } from "./_utils/level-test-planning-start";
import { withLevelTestChange } from "./_utils/level-test-result-change";
import { getLevelTestStart } from "./_utils/level-test-start-score";
import {
  canWriteLevelTest,
  levelTestDetailsWithProgress,
  loadLevelTestContext,
  readLevelTestProgress,
} from "./_utils/level-test-state";
import { recordLevelTestActivity } from "./_utils/record-level-test-activity";
import {
  type LevelTestBank,
  type LevelTestProgress,
  type LevelTestResult,
} from "./level-test-contract";
import {
  type LevelTestScores,
  getBand,
  getLevelTestConfirmation,
  getLevelTestFloors,
  getLevelTestRanges,
  listLevelTestLevels,
  toLevelLabels,
} from "./level-test-rules";
import { readLevelTestAttempts } from "./read-level-test-summary";

export type FinishLanguageLevelTestResult =
  | {
      levels: { label: string; score: number; skill: LanguageSkill }[];
      result?: LevelTestResult & { changeId: string | null };
      status: "ready";
    }
  | { status: "notFound" | "notLanguage" | "notReady" | "unauthorized" };

async function saveSkillLevels(
  transaction: TransactionClient,
  { language, scores, userId }: { language: string; scores: LevelTestScores; userId: string },
) {
  const levels = listLevelTestLevels(scores);

  await transaction.languageSkillLevel.createMany({
    data: levels.map(({ score, skill }) => ({ language, score, skill, startScore: score, userId })),
    skipDuplicates: true,
  });

  for (const { score, skill } of levels) {
    // oxlint-disable-next-line no-await-in-loop -- An interactive transaction uses one Postgres connection.
    await transaction.languageSkillLevel.updateMany({
      data: { score, startScore: score },
      where: {
        language,
        raisedAt: null,
        score: { equals: transaction.languageSkillLevel.fields.startScore },
        skill,
        userId,
      },
    });
  }
}

async function recordLevelTestResult({
  bank,
  current,
  currentProgress,
  timeZone,
  transaction,
}: {
  bank: LevelTestBank;
  current: Parameters<typeof levelTestDetailsWithProgress>[0] & {
    id: string;
    language: string;
    targetLanguage: string;
    userId: string;
  };
  currentProgress: LevelTestProgress;
  timeZone: string;
  transaction: TransactionClient;
}) {
  const { id: goalId, userId } = current;
  const now = new Date();
  const input = { bank, progress: currentProgress, start: currentProgress.start };
  const scores = getLevelTestFloors(input);
  const { shortLevels, through } = getLevelTestConfirmation(input);
  const lock = await getCompletionEnergyContext({ timeZone, transaction, userId });
  const itemIds = await skipConfirmedLanguageLessons({ goalId, now, through, tx: transaction });
  const { usedConfirmations } = readLevelTestAttempts(current);

  const result = {
    attemptId: currentProgress.attemptId ?? null,
    end: getLevelTestEnd(input),
    finishedAt: now.toISOString(),
    lessonsSkipped: itemIds.length,
    levelsSkipped: through && itemIds.length > 0 ? CEFR_LEVELS.slice(0, getBand(through) + 1) : [],
    ranges: getLevelTestRanges(input),
  };

  const stated = getLevelTestStart(readGoalDetails(current).level);

  const planningStart = getLevelTestPlanningStart(
    input,
    stated.firstBand ?? stated.start,
    result.levelsSkipped.at(-1),
  );

  const saved = { ...currentProgress, counted: currentProgress.answers.length, result, scores };

  const details = levelTestDetailsWithProgress(current, saved);

  const answeredIds = new Set(
    currentProgress.answers.filter(({ skipped }) => !skipped).map(({ id }) => id),
  );

  const checksUsed = (bank.confirmations ?? []).filter(({ id }) => answeredIds.has(id));
  const levelsToRefill = new Set([...shortLevels, ...checksUsed.map(({ level }) => level)]);

  await recordLevelTestActivity({
    bank,
    goalId,
    lock,
    progress: currentProgress,
    timeZone,
    transaction,
    userId,
  });

  await transaction.goal.update({
    data: {
      details: {
        ...details,
        levelTest: {
          ...details.levelTest,
          lastResult: result,
          ...(planningStart !== null && { planningStart }),
          usedConfirmations: [...usedConfirmations, ...checksUsed.map(({ id }) => id)],
        },
        ...(planningStart !== null && {
          skillLevels: { ...readPreviousSkillLevels(current), ...toLevelLabels(scores) },
        }),
      },
    },
    where: { id: goalId },
  });

  if (planningStart !== null) {
    await saveSkillLevels(transaction, { language: current.targetLanguage, scores, userId });
  }

  if (levelsToRefill.size > 0 && bank.confirmations) {
    await oweFollowUps({
      db: transaction,
      followUps: [...levelsToRefill].map((level) => ({
        input: {
          goalId,
          level,
          pair: { language: current.language, targetLanguage: current.targetLanguage },
        },
        kind: "replenishLevelTestChecks",
      })),
      userId,
    });
  }

  await owePlanStartLessons({ db: transaction, goalId, userId });

  await recordTestOutChange({
    goalId,
    itemIds,
    now,
    receipt: levelTestReceipt(result.attemptId),
    timeZone,
    tx: transaction,
    userId,
  });

  return saved;
}

function readPreviousSkillLevels(goal: Parameters<typeof readGoalDetails>[0]) {
  const { skillLevels } = readGoalDetails(goal);
  return isJsonObject(skillLevels) ? skillLevels : {};
}

export async function finishLanguageLevelTest(
  goalId: string,
  attemptId?: string,
): Promise<FinishLanguageLevelTestResult> {
  const context = await loadLevelTestContext(goalId, attemptId);

  if (context.status !== "ready") {
    return context;
  }

  const { bank, owned } = context;

  if (!bank) {
    return { status: "notReady" };
  }

  const { goal, userId } = owned;
  const timeZone = getAnswerTimeZone({ goal });

  const finished = await writeLearnerChange({ planInputs: true, userId }, async (transaction) => {
    const current = await transaction.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
    const progress = readLevelTestProgress(current, attemptId);

    if (!progress) {
      return unchanged(null);
    }

    const { placement } = progress;
    const legacyItemIds = placement?.unannounced;

    if (!attemptId && placement && legacyItemIds?.length) {
      const migrated = { ...progress, placement: { placed: placement.placed } };

      await transaction.goal.update({
        data: { details: levelTestDetailsWithProgress(current, migrated) },
        where: { id: goalId },
      });

      await recordTestOutChange({
        goalId,
        itemIds: legacyItemIds,
        now: new Date(),
        receipt: levelTestReceipt(null),
        timeZone,
        tx: transaction,
        userId,
      });

      return { newResult: false, progress: migrated };
    }

    if (progress.result || progress.placement || !canWriteLevelTest(current, progress)) {
      return unchanged({ newResult: false, progress });
    }

    return {
      newResult: true,
      progress: await recordLevelTestResult({
        bank,
        current: { ...current, targetLanguage: goal.targetLanguage },
        currentProgress: progress,
        timeZone,
        transaction,
      }),
    };
  });

  if (!finished) {
    return { status: "notFound" };
  }

  const { newResult, progress } = finished;

  if (newResult) {
    revalidateCacheTags([
      getGoalsCacheTag(userId),
      getLearnerModelCacheTag(userId),
      getUserProgressCacheTag(userId),
    ]);

    await trackLearnerEvents({
      events: [
        {
          name: "Level Test Finished",
          properties: { answered: progress.answers.length, target_language: goal.targetLanguage },
        },
      ],
      goalId,
      userId,
    });
  }

  const { result } = progress;

  return {
    levels: listLevelTestLevels(progress.scores ?? {}),
    ...(result && { result: await withLevelTestChange(goalId, result) }),
    status: "ready",
  };
}
