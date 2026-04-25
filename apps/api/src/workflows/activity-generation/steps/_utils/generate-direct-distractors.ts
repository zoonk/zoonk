import { generateActivityDistractors } from "@zoonk/ai/tasks/activities/language/distractors";
import { type DistractorShape, sanitizeDistractors } from "@zoonk/utils/distractors";
import { safeAsync } from "@zoonk/utils/error";

type DistractorEntry = {
  input: string;
  key: string;
};

/**
 * Generates and sanitizes direct distractor words for a batch of inputs.
 *
 * This helper keeps the workflow steps small and consistent:
 * - call the shared AI task
 * - normalize and clean the output
 * - preserve per-input ordering
 *
 * Failures throw the original AI error so Workflow retries the owning step
 * instead of silently saving activities with missing distractors.
 */
export async function generateDirectDistractors(params: {
  entries: DistractorEntry[];
  language: string;
  shape: DistractorShape;
}): Promise<Record<string, string[]>> {
  const results: (readonly [string, string[]])[] = await Promise.all(
    params.entries.map(async (entry) => {
      const { data: result, error } = await safeAsync(() =>
        generateActivityDistractors({
          input: entry.input,
          language: params.language,
          shape: params.shape,
        }),
      );

      if (error || !result?.data) {
        throw error ?? new Error("distractorGenerationFailed");
      }

      return [
        entry.key,
        sanitizeDistractors({
          distractors: result.data.distractors,
          input: entry.input,
          shape: params.shape,
        }),
      ] as const;
    }),
  );

  return Object.fromEntries(results) as Record<string, string[]>;
}
