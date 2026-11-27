"use server";

import {
  mistakePracticeFinishInputSchema,
  mistakePracticeInputSchema,
} from "@zoonk/core/mistakes/contract";
import { getMistakePractice } from "@zoonk/core/mistakes/practice";
import { finishMistakePractice } from "@zoonk/core/mistakes/practice-finish";
import { type MistakePracticeSummary, type PracticeEntry } from "@zoonk/learn/mistakes/practice";

/** "Practice again": a fresh batch in the run's own scope, with every format as the page asks. */
export async function loadMistakePracticeAction(input: unknown): Promise<PracticeEntry[] | null> {
  const parsed = mistakePracticeInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const result = await getMistakePractice({ ...parsed.data, includeAllFormats: true });
  return result.status === "ready" ? result.practice : null;
}

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
