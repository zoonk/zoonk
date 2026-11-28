import "server-only";
import { prisma } from "@zoonk/db";
import { nextPlanLessonQuery } from "../../../plans/_utils/next-plan-lesson";
import { readTestOutChange } from "../../../plans/_utils/read-test-out-change";
import { levelTestReceipt } from "../../../plans/_utils/test-out-receipt";
import { type LevelTestResult } from "../level-test-contract";

export async function withLevelTestChange(goalId: string, result: LevelTestResult) {
  const [change, item] = await Promise.all([
    result.lessonsSkipped
      ? readTestOutChange({ goalId, receipt: levelTestReceipt(result.attemptId) })
      : null,
    prisma.planItem.findFirst({
      ...nextPlanLessonQuery(goalId),
      select: { lesson: { select: { id: true, title: true } } },
    }),
  ]);

  return {
    ...result,
    changeId: change?.id ?? null,
    ...(item?.lesson && { nextLesson: item.lesson }),
  };
}
