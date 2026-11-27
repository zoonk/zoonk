import "server-only";
import { prisma } from "@zoonk/db";
import { readPlacementNextLesson } from "../../../learner/placement/_utils/placement-result";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { levelTestReceipt } from "../../../plans/_utils/test-out-receipt";
import { type LevelTestResult } from "../level-test-contract";

export async function withLevelTestChange(goalId: string, result: LevelTestResult) {
  const [change, nextLesson] = await Promise.all([
    result.lessonsSkipped
      ? readTestOutChange({ goalId, receipt: levelTestReceipt(result.attemptId) })
      : null,
    readPlacementNextLesson(goalId, prisma),
  ]);

  return { ...result, changeId: change?.id ?? null, ...(nextLesson && { nextLesson }) };
}
