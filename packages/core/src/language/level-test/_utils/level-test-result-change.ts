import "server-only";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { levelTestReceipt } from "../../../plans/_utils/test-out-receipt";
import { type LevelTestResult } from "../level-test-contract";

export async function withLevelTestChange(goalId: string, result: LevelTestResult) {
  const change = result.lessonsSkipped
    ? await readTestOutChange({ goalId, receipt: levelTestReceipt(result.attemptId) })
    : null;

  return { ...result, changeId: change?.id ?? null };
}
