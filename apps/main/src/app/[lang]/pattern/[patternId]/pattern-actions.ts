"use server";

import { mistakePatternPracticeInputSchema } from "@zoonk/core/language/patterns/contract";
import { dismissMistakePattern } from "@zoonk/core/language/patterns/dismiss";
import { practiceMistakePattern } from "@zoonk/core/language/patterns/practice";
import { type PatternPracticeResult } from "@zoonk/learn/language/pattern";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/**
 * Saves a pattern's drill through core, which checks each answer, pays Brain Power and takes the
 * pattern off Today. The same capability as `POST /v1/mistake-patterns/{patternId}/practices`.
 */
export async function practicePatternAction(
  patternId: string,
  input: { answers: string[]; timeZone: string },
): Promise<PatternPracticeResult | null> {
  const parsed = mistakePatternPracticeInputSchema.safeParse(input);

  if (!parsed.success) {
    return null;
  }

  const { data, error } = await safeAsync(() =>
    practiceMistakePattern({ input: parsed.data, patternId }),
  );

  if (error) {
    logError("[practicePatternAction] Failed to save a pattern drill:", error);
    return null;
  }

  return data.status === "ready" ? data.result : null;
}

/** Takes a typos note off Today once read: the same capability as `POST .../dismissals`. */
export async function dismissPatternAction(patternId: string): Promise<void> {
  const { error } = await safeAsync(() => dismissMistakePattern(patternId));

  if (error) {
    logError("[dismissPatternAction] Failed to dismiss a pattern:", error);
  }
}
