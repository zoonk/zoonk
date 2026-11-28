import "server-only";
import { type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type AnalyticsEvent } from "../../analytics/events";
import { type TestEnd } from "../../analytics/test-event-catalog";
import { testEventContext, trackTestEvents } from "../../analytics/test-events";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import {
  getGoalsCacheTag,
  getLearnerModelCacheTag,
  getUserProgressCacheTag,
} from "../../cache/tags";
import { owePlanStartLessons } from "../../follow-ups/owe-goal-lessons";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { isSkillConfirmed } from "../../learner/_utils/skill-claims";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { levelTestOutReceipt } from "../../plans/_utils/test-out-receipt";
import { recordTestOutChange } from "../../plans/record-test-out-change";
import { settleAnsweredActivity } from "../../stats/_utils/settle-answered-activity";
import { getCompletionEnergyContext } from "../../stats/completion-energy";
import {
  loadTestOutAnswers,
  nextTestOutQuestion,
  saveTestOut,
} from "./_utils/level-test-out-state";
import { skipConfirmedLanguageLessons } from "./_utils/level-test-placement";
import {
  type LanguageLevelTestOutResult,
  getLanguageLevelTestOut,
} from "./language-level-test-out";
import { type LevelTestOutProgress } from "./level-test-out-contract";
import { readLevelTestAttempts } from "./read-level-test-summary";

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
      fromLesson: false,
      itemId: { not: null },
      mockExamId: null,
      skillId: { in: skillIds },
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

function testOutEnd({
  answered,
  canContinue,
  passed,
  questions,
}: {
  answered: number;
  canContinue: boolean;
  passed: boolean;
  questions: number;
}): TestEnd {
  if (answered < questions) {
    return canContinue ? "stopped" : "material_exhausted";
  }

  return passed ? "check_passed" : "check_missed";
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
        return unchanged({ event: null });
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

      await recordTestOutChange({
        goalId,
        itemIds,
        now,
        receipt: levelTestOutReceipt(attemptId),
        timeZone,
        tx,
        userId,
      });

      if (itemIds.length > 0) {
        await owePlanStartLessons({ db: tx, goalId, userId });
      }

      const next =
        answers.length < testOut.questions.length
          ? await nextTestOutQuestion({
              answered: new Set(answers.map(({ itemId }) => itemId)),
              progress: testOut,
              tx,
            })
          : null;

      const event: AnalyticsEvent = {
        name: "Test Finished",
        properties: {
          ...testEventContext(current, {
            attemptId,
            questions: testOut.questions.length,
            test: "level_test_out",
          }),
          answered: answers.length,
          duration_ms: answers.reduce((total, answer) => total + answer.durationMs, 0),
          end: testOutEnd({
            answered: answers.length,
            canContinue: next !== null,
            passed: topicIds.size > 0,
            questions: testOut.questions.length,
          }),
          lessons_skipped: itemIds.length,
          levels_skipped: itemIds.length > 0 ? 1 : 0,
          parts_left: 0,
          unknowns: answers.filter(({ answer }) => isJsonObject(answer) && answer.dontKnow === true)
            .length,
        },
      };

      return { event };
    },
  );

  if (!progress) {
    return { status: "notFound" };
  }

  if (progress.event) {
    trackTestEvents(goal, [progress.event]);
  }

  revalidateCacheTags([
    getGoalsCacheTag(userId),
    getLearnerModelCacheTag(userId),
    getUserProgressCacheTag(userId),
  ]);

  return getLanguageLevelTestOut({ attemptId, goalId });
}
