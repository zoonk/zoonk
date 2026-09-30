"use server";

import { chapterTestOutInputSchema } from "@zoonk/core/learner/test-out/contract";
import { submitChapterTestOut } from "@zoonk/core/learner/test-out/submit";
import { type TestOutOutcome } from "@zoonk/learn/test-out";

/** Grades the test-out through core, which takes the chapter's lessons off the plan when it passes. */
export async function submitTestOutAction(
  { chapterId, goalId }: { chapterId: string; goalId: string },
  answers: unknown,
): Promise<TestOutOutcome> {
  const input = chapterTestOutInputSchema.safeParse({ answers });

  if (!input.success) {
    return null;
  }

  const result = await submitChapterTestOut({ chapterId, goalId, input: input.data });

  if (result.status !== "ready") {
    return null;
  }

  const { outcome } = result;

  return {
    correct: outcome.correct,
    passed: outcome.passed,
    skippedLessons: outcome.testedOutPlanItemIds.length,
    total: outcome.total,
  };
}
