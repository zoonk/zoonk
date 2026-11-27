"use server";

import { getOwnedGoal } from "@zoonk/core/goals/owned-goal";
import {
  type LanguageLevelTestView,
  type LevelTestResult,
  levelTestOutLevelSchema,
} from "@zoonk/core/language/level-test/contract";
import { finishLanguageLevelTest } from "@zoonk/core/language/level-test/finish";
import { getLanguageLevelTest } from "@zoonk/core/language/level-test/get";
import { startLanguageLevelTest } from "@zoonk/core/language/level-test/start";
import { readLevelTestAttempts } from "@zoonk/core/language/level-test/summary";
import {
  type LanguageLevelTestOutResult,
  answerLanguageLevelTestOut,
  getLanguageLevelTestOut,
  getNextAvailableLevelTestOut,
  startLanguageLevelTestOut,
} from "@zoonk/core/language/level-test/test-out";
import { levelTestOutAnswerSchema } from "@zoonk/core/language/level-test/test-out-contract";
import { finishLanguageLevelTestOut } from "@zoonk/core/language/level-test/test-out-finish";
import { isUuid } from "@zoonk/utils/uuid";

type TestOutView = Extract<LanguageLevelTestOutResult, { status: "ready" }>["test"];

function toTestOutView(result: LanguageLevelTestOutResult): TestOutView | null {
  return result.status === "ready" ? result.test : null;
}

/** Opens a level test, or answers with the one already open. */
export async function startLevelTestAttemptAction(
  goalId: string,
): Promise<LanguageLevelTestView | null> {
  if (!isUuid(goalId)) {
    return null;
  }

  const result = await startLanguageLevelTest({ goalId });
  return result.status === "ready" ? result.test : null;
}

/** Null when it wasn't saved. */
export async function finishLevelTestAttemptAction(
  goalId: string,
  attemptId: string,
): Promise<{ nextTestOutLevel: string | null; result: LevelTestResult | null } | null> {
  if (!isUuid(goalId) || !isUuid(attemptId)) {
    return null;
  }

  const finished = await finishLanguageLevelTest(goalId, attemptId);

  if (finished.status !== "ready") {
    return null;
  }

  const nextTestOutLevel = await getNextAvailableLevelTestOut(goalId);

  return { nextTestOutLevel, result: finished.result ?? null };
}

/** The open attempt, when one is; read-only. */
export async function getLevelTestAttemptAction(
  goalId: string,
): Promise<LanguageLevelTestView | null> {
  if (!isUuid(goalId)) {
    return null;
  }

  const owned = await getOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return null;
  }

  const attemptId = readLevelTestAttempts(owned.goal).attempt?.attemptId;
  const result = await getLanguageLevelTest(goalId, attemptId);
  return result.status === "ready" ? result.test : null;
}

export async function startLevelTestOutAction(
  goalId: string,
  level: unknown,
): Promise<TestOutView | null> {
  const parsed = levelTestOutLevelSchema.safeParse(level);

  if (!parsed.success || !isUuid(goalId)) {
    return null;
  }

  return toTestOutView(await startLanguageLevelTestOut({ goalId, level: parsed.data }));
}

/** Read-only, while its questions are written. */
export async function getLevelTestOutAction(
  goalId: string,
  attemptId: string,
): Promise<TestOutView | null> {
  if (!isUuid(goalId) || !isUuid(attemptId)) {
    return null;
  }

  return toTestOutView(await getLanguageLevelTestOut({ attemptId, goalId }));
}

export async function answerLevelTestOutAction(
  goalId: string,
  input: unknown,
): Promise<TestOutView | null> {
  const parsed = levelTestOutAnswerSchema.safeParse(input);

  if (!parsed.success || !isUuid(goalId)) {
    return null;
  }

  return toTestOutView(await answerLanguageLevelTestOut({ goalId, input: parsed.data }));
}

export async function finishLevelTestOutAction(
  goalId: string,
  attemptId: string,
): Promise<TestOutView | null> {
  if (!isUuid(goalId) || !isUuid(attemptId)) {
    return null;
  }

  return toTestOutView(await finishLanguageLevelTestOut({ attemptId, goalId }));
}
