"use server";

import { mistakePracticeFinishInputSchema } from "@zoonk/core/mistakes/contract";
import { finishMistakePractice } from "@zoonk/core/mistakes/practice-finish";
import { type MistakePracticeSummary } from "@zoonk/learn/mistakes/practice";

export async function finishMistakePracticeAction(
  input: unknown,
): Promise<MistakePracticeSummary | null> {
  const parsed = mistakePracticeFinishInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await finishMistakePractice(parsed.data);
  return result.status === "ready" ? result.result : null;
}
