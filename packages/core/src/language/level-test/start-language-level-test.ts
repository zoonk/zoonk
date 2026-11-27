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
import { getLevelTestStart } from "./_utils/level-test-start-score";
import { levelTestDetailsWithProgress, readLevelTestProgress } from "./_utils/level-test-state";
import { getLanguageLevelTest } from "./get-language-level-test";
import { type LevelTestLength, type LevelTestProgress } from "./level-test-contract";
import { isOpenLevelTestOut } from "./level-test-out-contract";
import { readLevelTestAttempts } from "./read-level-test-summary";

async function oweLevelTestPreparation({
  db,
  goalId,
  pair,
  userId,
}: {
  db: TransactionClient;
  goalId: string;
  pair: LanguagePair;
  userId: string;
}) {
  const bank = readBank(await findBankRow(pair, db));
  const levelTestBank = bank?.confirmations === undefined ? pair : undefined;

  await oweFollowUps({
    db,
    followUps: levelTestBank
      ? [{ input: { goalId, pair: levelTestBank }, kind: "prepareLevelTestBank" }]
      : [],
    userId,
  });
}

export async function startLanguageLevelTest({
  goalId,
}: {
  goalId: string;
  length?: LevelTestLength;
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

    if (isOpenLevelTestOut(testOut)) {
      return unchanged(null);
    }

    if (attempt?.attemptId && !attempt.result) {
      return unchanged({ attemptId: attempt.attemptId, opened: false });
    }

    const legacy = readLevelTestProgress(current);
    const level = await loadCurrentLanguageLevel(current, { db });

    const start = getLevelTestStart(level ?? readGoalDetails(current).level);

    const continueOnboarding =
      !attempt && !legacy.result && !legacy.placement && legacy.answers.length > 0;

    const fresh: LevelTestProgress = { answers: [], counted: 0, speaking: null, ...start };
    const id = randomUUID();

    const progress: LevelTestProgress = {
      ...(continueOnboarding ? legacy : fresh),
      attemptId: id,
      startedAt: (continueOnboarding && legacy.startedAt) || new Date().toISOString(),
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

    await oweLevelTestPreparation({ db, goalId, pair: { language, targetLanguage }, userId });

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
