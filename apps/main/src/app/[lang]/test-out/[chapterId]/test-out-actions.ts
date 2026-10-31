"use server";

import { chapterTestOutInputSchema } from "@zoonk/core/learner/test-out/contract";
import { submitChapterTestOut } from "@zoonk/core/learner/test-out/submit";
import { type TestOutOutcome } from "@zoonk/learn/test-out";

/** The same test sent again (`requestId`) gets what it recorded. */
export async function submitTestOutAction(
  { chapterId, goalId }: { chapterId: string; goalId: string },
  input: unknown,
): Promise<TestOutOutcome> {
  const parsed = chapterTestOutInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await submitChapterTestOut({ chapterId, goalId, input: parsed.data });

  if (result.status !== "ready") {
    return null;
  }

  const { outcome } = result;

  return {
    ceremony: outcome.ceremony,
    changeId: outcome.changeId,
    correct: outcome.correct,
    passed: outcome.passed,
    reached: outcome.reached,
    skippedLessons: outcome.lessonsSkipped,
    total: outcome.total,
  };
}
