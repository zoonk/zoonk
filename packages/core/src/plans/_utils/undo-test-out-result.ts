import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { isJsonObject } from "@zoonk/utils/json";
import { type LevelTestResult } from "../../language/level-test/level-test-contract";
import {
  readLevelTestAttempts,
  readLevelTestDetails,
} from "../../language/level-test/read-level-test-summary";
import { readPlacementAttempt } from "../../learner/placement/_utils/placement-attempt-record";
import { readPlacementNextLesson } from "../../learner/placement/_utils/placement-result";
import { levelTestOutReceipt, levelTestReceipt, placementPartReceipt } from "./test-out-receipt";

function clearResult(result: LevelTestResult | undefined, receipt: string) {
  return result && levelTestReceipt(result.attemptId) === receipt
    ? { ...result, changeId: null, lessonsSkipped: 0, levelsSkipped: [] }
    : result;
}

function restoreLevelTest(details: Goal["details"], receipt: string) {
  const goal = { details };
  const { attempt, completedAttempt, lastResult, testOut } = readLevelTestAttempts(goal);
  const levelTest = readLevelTestDetails(goal);

  if (testOut?.result && levelTestOutReceipt(testOut.id) === receipt) {
    return {
      ...levelTest,
      testOut: { ...testOut, result: { ...testOut.result, planItemIds: [], topicsSkipped: [] } },
    };
  }

  const result = attempt?.result && clearResult(attempt.result, receipt);
  const completed = completedAttempt?.result && clearResult(completedAttempt.result, receipt);
  const latest = clearResult(lastResult, receipt);

  if (
    result === attempt?.result &&
    completed === completedAttempt?.result &&
    latest === lastResult
  ) {
    return null;
  }

  return {
    ...levelTest,
    ...(attempt && result && { attempt: { ...attempt, result } }),
    ...(completedAttempt &&
      completed && { completedAttempt: { ...completedAttempt, result: completed } }),
    ...(latest && { lastResult: latest }),
  };
}

async function restorePlacement({
  details,
  goalId,
  lessonsSkipped,
  receipt,
  tx,
}: {
  details: unknown;
  goalId: string;
  lessonsSkipped: number;
  receipt: string;
  tx: TransactionClient;
}) {
  const { attempt, finishedParts, result, ...rest } = readPlacementAttempt({ details });
  const attemptId = attempt?.id ?? result?.attemptId;
  const [receiptId] = receipt.split(":");

  const part =
    attemptId && attemptId === receiptId
      ? finishedParts.find(
          (finished) =>
            placementPartReceipt(
              attemptId,
              finished.part,
              finished.finish?.end === "stopped" ? finished.finish.answered : undefined,
            ) === receipt,
        )
      : undefined;

  const updatedResult =
    result && result.attemptId === receiptId
      ? {
          ...result,
          lessonsSkipped: Math.max(0, result.lessonsSkipped - lessonsSkipped),
          nextLesson: await readPlacementNextLesson(goalId, tx),
        }
      : result;

  if (!part && updatedResult === result) {
    return null;
  }

  return {
    ...rest,
    attempt:
      attempt && part
        ? { ...attempt, lessonsSkipped: Math.max(0, attempt.lessonsSkipped - lessonsSkipped) }
        : attempt,
    finishedParts: finishedParts.map((finished) =>
      finished === part ? { ...finished, lessonsSkipped: 0, testedOutPlanItemIds: [] } : finished,
    ),
    result: updatedResult,
  };
}

export async function undoTestOutResult({
  goalId,
  receipt,
  lessonsSkipped,
  tx,
}: {
  goalId: string;
  receipt: string;
  lessonsSkipped: number;
  tx: TransactionClient;
}) {
  const { details } = await tx.goal.findUniqueOrThrow({
    select: { details: true },
    where: { id: goalId },
  });

  if (!isJsonObject(details)) {
    return;
  }

  const languageReceipt = receipt.startsWith("levelTest");

  const result = languageReceipt
    ? restoreLevelTest(details, receipt)
    : await restorePlacement({ details, goalId, lessonsSkipped, receipt, tx });

  if (result) {
    await tx.goal.update({
      data: { details: { ...details, [languageReceipt ? "levelTest" : "placementTest"]: result } },
      where: { id: goalId },
    });
  }
}
