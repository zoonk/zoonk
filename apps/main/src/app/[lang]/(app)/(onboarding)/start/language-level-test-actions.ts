"use server";

import { postAsLearner } from "@/lib/api/learner-api";
import { answerLanguageLevelTest } from "@zoonk/core/language/level-test/answer";
import {
  type LanguageLevelTestView,
  levelTestAnswerInputSchema,
} from "@zoonk/core/language/level-test/contract";
import { isUuid } from "@zoonk/utils/uuid";

/** Only from the learner's tap to begin or try again, never from showing the test. */
export async function startLevelTestBankAction(goalId: string): Promise<boolean> {
  if (!isUuid(goalId)) {
    return false;
  }

  const response = await postAsLearner({
    path: `/v1/goals/${encodeURIComponent(goalId)}/language-level-test/generations`,
  });

  return response.ok;
}

export async function answerLevelTestAction(
  goalId: string,
  input: unknown,
): Promise<LanguageLevelTestView | null> {
  const parsed = levelTestAnswerInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await answerLanguageLevelTest({ goalId, input: parsed.data });
  return result.status === "ready" ? result.test : null;
}
