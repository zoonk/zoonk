import "server-only";
import { randomUUID } from "node:crypto";
import { type TransactionClient } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getGoalsCacheTag } from "../../cache/tags";
import { oweFollowUps } from "../../follow-ups/owe-follow-ups";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { readGoalDetails } from "../_utils/language-goal";
import { loadCurrentLanguageLevel } from "../levels/current-language-level";
import { type LanguagePair, findBankRow, readBank } from "./_utils/level-test-bank";
import { getLevelTestStartScore } from "./_utils/level-test-start-score";
import { levelTestDetailsWithProgress, readLevelTestProgress } from "./_utils/level-test-state";
import { getLanguageLevelTest } from "./get-language-level-test";
import { type LevelTestLength, type LevelTestProgress } from "./level-test-contract";
import { hasOpenLanguageTopicWalk, readLevelTestAttempts } from "./read-level-test-summary";

async function oweLevelTestPreparation({
  db,
  goalId,
  length,
  pair,
  userId,
}: {
  db: TransactionClient;
  goalId: string;
  length: LevelTestLength;
  pair: LanguagePair;
  userId: string;
}) {
  const bank = readBank(await findBankRow(pair, db));
  const levelTestBank = bank?.confirmations === undefined ? pair : undefined;
  const writeTopics = length === "wholeCourse";

  await oweFollowUps({
    db,
    followUps:
      levelTestBank || writeTopics
        ? [
            {
              input: { goalId, levelTestBank, waitsForNotice: false, writeTopics },
              kind: "preparePlacementItems",
            },
          ]
        : [],
    userId,
  });
}

export async function startLanguageLevelTest({
  goalId,
  length,
}: {
  goalId: string;
  length: LevelTestLength;
}) {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;
  const { language, targetLanguage } = goal;

  if (goal.kind !== "language" || !targetLanguage) {
    return { status: "notLanguage" } as const;
  }

  const selected = await writeLearnerChange({ userId }, async (db) => {
    const current = await db.goal.findUniqueOrThrow({ where: { id: goalId, userId } });
    const { attempt, testOut } = readLevelTestAttempts(current);

    if (
      hasOpenLanguageTopicWalk(current) ||
      (testOut && (!testOut.result || testOut.result.unannounced.length > 0))
    ) {
      return unchanged(null);
    }

    if (attempt?.attemptId && (!attempt.result || attempt.placement?.unannounced.length)) {
      return unchanged({ attemptId: attempt.attemptId, opened: false });
    }

    const legacy = readLevelTestProgress(current);
    const level = await loadCurrentLanguageLevel(current, db);

    const start = getLevelTestStartScore({
      length,
      level: level ?? readGoalDetails(current).level,
    });

    const continueOnboarding = !attempt && !legacy.placement && legacy.answers.length > 0;
    const fresh: LevelTestProgress = { answers: [], counted: 0, speaking: null, start };
    const id = randomUUID();

    const progress: LevelTestProgress = {
      ...(continueOnboarding ? legacy : fresh),
      attemptId: id,
      length,
      startedAt: continueOnboarding ? legacy.startedAt : new Date().toISOString(),
    };

    const details = levelTestDetailsWithProgress(current, progress);

    await db.goal.update({
      data: {
        details: {
          ...details,
          levelTest: {
            ...details.levelTest,
            ...(attempt?.result && { completedAttempt: attempt }),
          },
        },
      },
      where: { id: goalId },
    });

    await oweLevelTestPreparation({
      db,
      goalId,
      length,
      pair: { language, targetLanguage },
      userId,
    });

    return { attemptId: id, opened: true };
  });

  if (!selected) {
    return { status: "invalid" } as const;
  }

  const { attemptId, opened } = selected;

  if (opened) {
    revalidateCacheTags([getGoalsCacheTag(userId)]);
  }

  return getLanguageLevelTest(goalId, attemptId);
}
