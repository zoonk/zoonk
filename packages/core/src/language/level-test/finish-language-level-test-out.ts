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
import {
  type LanguageLevelTestOutResult,
  getLanguageLevelTestOut,
} from "./language-level-test-out";
import { type LevelTestOutProgress } from "./level-test-out-contract";
import { readLevelTestAttempts } from "./read-level-test-summary";

class AlreadyAnnouncedError extends Error {
  override name = "AlreadyAnnouncedError";
}

function getPassedTopics({
  answers,
  progress,
}: {
  answers: Awaited<ReturnType<typeof loadTestOutAnswers>>;
  progress: LevelTestOutProgress;
}): Set<string> {
  const asked = Map.groupBy(progress.questions, ({ skill }) => skill);

  const passed = (["reading", "listening"] as const).flatMap((skill) => {
    const group = asked.get(skill);
    const ids = new Set(group?.map(({ id }) => id));

    const evidence = answers.flatMap(({ isCorrect, item, itemId, localDate }) =>
      item && itemId && ids.has(itemId) ? [{ ...item, isCorrect, itemId, localDate }] : [],
    );

    return isSkillConfirmed({ answers: evidence }) ? [group?.[0]?.skillId] : [];
  });

  return new Set(passed.length === 2 ? passed.filter((id) => id !== undefined) : []);
}

async function announceSkips({
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
    return;
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

  const { error } = await safeAsync(() =>
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

      if (testOut?.id !== attemptId) {
        return unchanged(null);
      }

      if (testOut.result) {
        return unchanged(testOut);
      }

      const answers = await loadTestOutAnswers({ progress: testOut, tx, userId });
      const now = new Date();
      const topicIds = getPassedTopics({ answers, progress: testOut });

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

  await announceSkips({ goalId, progress, timeZone });
  return getLanguageLevelTestOut({ attemptId, goalId });
}
