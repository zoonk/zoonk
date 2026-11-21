import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { isSkillConfirmed } from "../../learner/_utils/skill-claims";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { announceTestedOutItems } from "../../plans/announce-tested-out-items";
import { isPlanConflictError } from "../../plans/plan-conflict";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import { loadTestOutAnswers, saveTestOut } from "./_utils/level-test-out-state";
import { skipConfirmedLanguageLessons } from "./_utils/level-test-placement";
import { oweLevelTestNotice } from "./_utils/owe-level-test-notice";
import {
  type LanguageLevelTestOutResult,
  getLanguageLevelTestOut,
} from "./language-level-test-out";
import { type LevelTestOutProgress } from "./level-test-out-contract";
import { readLevelTestAttempts } from "./read-level-test-summary";

class AlreadyAnnouncedError extends Error {
  override name = "AlreadyAnnouncedError";
}

async function getPassedTopics({
  progress,
  tx,
  userId,
}: {
  progress: LevelTestOutProgress;
  tx: TransactionClient;
  userId: string;
}): Promise<Set<string>> {
  const asked = Map.groupBy(progress.questions, ({ skill }) => skill);
  const skillIds = [...new Set(progress.questions.map(({ skillId }) => skillId))];

  const firstAnswers = await tx.attempt.findMany({
    distinct: ["itemId"],
    orderBy: [{ answeredAt: "asc" }, { id: "asc" }],
    select: {
      focusTestId: true,
      isCorrect: true,
      item: { select: { content: true, format: true } },
      itemId: true,
      localDate: true,
      skillId: true,
    },
    where: {
      itemId: { not: null },
      mockExamId: null,
      skillId: { in: skillIds },
      stepId: null,
      userId,
    },
  });

  const passed = (["reading", "listening"] as const).flatMap((skill) => {
    const group = asked.get(skill);
    const skillId = group?.[0]?.skillId;
    const ids = new Set(group?.map(({ id }) => id));

    if (!skillId) {
      return [];
    }

    const evidence = firstAnswers.flatMap((answer) => {
      const { focusTestId, isCorrect, item, itemId, localDate } = answer;
      const isSample = focusTestId === progress.id && itemId && ids.has(itemId);

      return item && itemId && answer.skillId === skillId && (isSample || !isCorrect)
        ? [{ ...item, isCorrect, itemId, localDate }]
        : [];
    });

    return isSkillConfirmed({ answers: evidence }) ? [skillId] : [];
  });

  return new Set(passed.length === 2 ? passed : []);
}

export async function announceLevelTestOutSkips({
  goalId,
  progress,
  timeZone,
}: {
  goalId: string;
  progress: LevelTestOutProgress;
  timeZone: string;
}) {
  const ids = progress.result?.unannounced ?? [];

  if (ids.length === 0) {
    return true;
  }

  async function clear(tx: TransactionClient) {
    const goal = await tx.goal.findUniqueOrThrow({ where: { id: goalId } });
    const { testOut } = readLevelTestAttempts(goal);

    if (testOut?.id !== progress.id || !testOut.result?.unannounced.length) {
      throw new AlreadyAnnouncedError("The level test-out's skip was already recorded");
    }

    await saveTestOut({
      goal,
      progress: { ...testOut, result: { ...testOut.result, unannounced: [] } },
      tx,
    });
  }

  const { data, error } = await safeAsync(() =>
    announceTestedOutItems({
      extraWrites: clear,
      followToday: false,
      goalId,
      now: new Date(),
      planItemIds: ids,
      skipBlocks: false,
      timeZone,
    }),
  );

  if (error && !(error instanceof AlreadyAnnouncedError) && !isPlanConflictError(error)) {
    throw error;
  }

  return Boolean(data) || error instanceof AlreadyAnnouncedError;
}

export async function finishLanguageLevelTestOut({
  attemptId,
  goalId,
}: {
  attemptId: string;
  goalId: string;
}): Promise<LanguageLevelTestOutResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "language") {
    return { status: "notLanguage" };
  }

  const timeZone = getAnswerTimeZone({ goal });

  const progress = await writeLearnerChange(
    { goalIds: [goalId], planInputs: true, userId },
    async (tx) => {
      const current = await tx.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
      const { testOut } = readLevelTestAttempts(current);

      if (testOut?.id !== attemptId || testOut.questions.length === 0) {
        return unchanged(null);
      }

      if (testOut.result) {
        return unchanged(testOut);
      }

      const answers = await loadTestOutAnswers({ progress: testOut, tx, userId });
      const now = new Date();
      const topicIds = await getPassedTopics({ progress: testOut, tx, userId });

      const itemIds = await skipConfirmedLanguageLessons({
        goalId,
        now,
        through: testOut.level,
        topicIds,
        tx,
      });

      const finished = {
        ...testOut,
        result: {
          finishedAt: now.toISOString(),
          planItemIds: itemIds,
          topicsSkipped: itemIds.length > 0 ? [...topicIds] : [],
          unannounced: itemIds,
        },
      };

      if (answers.length > 0) {
        await settleAnsweredActivity(tx, {
          answers,
          contentIds: { levelTestOutId: attemptId },
          goalId,
          lessonKind: "testOut",
          lock: await getCompletionEnergyContext({ timeZone, transaction: tx, userId }),
          timeZone,
          userId,
        });
      }

      await saveTestOut({ goal: current, progress: finished, tx });
      await oweLevelTestNotice({ db: tx, goalId, unannounced: itemIds, userId });
      return finished;
    },
  );

  if (!progress) {
    return { status: "notFound" };
  }

  revalidateCacheTags([
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getUserProgressCacheTag(userId),
  ]);

  await announceLevelTestOutSkips({ goalId, progress, timeZone });
  return getLanguageLevelTestOut({ attemptId, goalId });
}
