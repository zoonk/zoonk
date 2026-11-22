import "server-only";
import { type LanguageSkill, type TransactionClient } from "@zoonk/db";
import { CEFR_LEVELS } from "@zoonk/utils/cefr";
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
import { oweTestOutChange } from "../../plans/_utils/owe-test-out-change";
import { levelTestReceipt } from "../../plans/_utils/test-out-receipt";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { readGoalDetails } from "../_utils/language-goal";
import { getOverallLevel } from "../levels/skill-level-rules";
import { skipConfirmedLanguageLessons } from "./_utils/level-test-placement";
import { withLevelTestChange } from "./_utils/level-test-result-change";
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
  getLevelTestRanges,
  getLevelTestScores,
  getNextLevelTestStep,
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
  const scores = getLevelTestScores(input);
  const { shortLevels, through } = getLevelTestConfirmation(input);
  const lock = await getCompletionEnergyContext({ timeZone, transaction, userId });
  const itemIds = await skipConfirmedLanguageLessons({ goalId, now, through, tx: transaction });
  const { usedConfirmations } = readLevelTestAttempts(current);

  const result = {
    attemptId: currentProgress.attemptId ?? null,
    finishedAt: now.toISOString(),
    lessonsSkipped: itemIds.length,
    levelsSkipped: through && itemIds.length > 0 ? CEFR_LEVELS.slice(0, getBand(through) + 1) : [],
    ranges: getLevelTestRanges(input),
    ...(currentProgress.length === "wholeCourse" &&
      getNextLevelTestStep(input).kind === "done" && { wholeCourseReady: true as const }),
  };

  const saved = { ...currentProgress, counted: currentProgress.answers.length, result, scores };

  const details = levelTestDetailsWithProgress(current, saved);
  const overall = getOverallLevel(listLevelTestLevels(scores).map(({ score }) => score));

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
        ...(overall && { level: overall }),
        levelTest: {
          ...details.levelTest,
          lastResult: result,
          usedConfirmations: [...usedConfirmations, ...checksUsed.map(({ id }) => id)],
        },
        skillLevels: { ...readPreviousSkillLevels(current), ...toLevelLabels(scores) },
      },
    },
    where: { id: goalId },
  });

  await saveSkillLevels(transaction, { language: current.targetLanguage, scores, userId });

  if (currentProgress.attemptId) {
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

  await oweTestOutChange({
    db: transaction,
    goalId,
    itemIds,
    receipt: levelTestReceipt(result.attemptId),
    timeZone,
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

      await oweTestOutChange({
        db: transaction,
        goalId,
        itemIds: legacyItemIds,
        receipt: levelTestReceipt(null),
        timeZone,
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
