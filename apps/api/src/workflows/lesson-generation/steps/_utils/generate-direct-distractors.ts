import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { type DistractorShape, sanitizeDistractors } from "@zoonk/utils/distractors";
import { safeAsync } from "@zoonk/utils/error";

type DistractorEntry = {
  input: string;
  key: string;
};

/**
 * Generates and sanitizes direct distractor words for a batch of inputs.
 *
 * This helper keeps the workflow steps small and consistent: call the shared
 * AI task, normalize the output, and preserve the key that each caller uses to
 * attach distractors back to saved lesson content.
 *
 * Failures throw the original AI error so Workflow retries the owning step
 * instead of silently saving lessons with missing distractors.
 */
export async function generateDirectDistractors(params: {
  entries: DistractorEntry[];
  language: string;
  shape: DistractorShape;
}): Promise<Record<string, string[]>> {
  const results = await Promise.all(
    params.entries.map(async (entry) => {
      const { data: result, error } = await safeAsync(() =>
        generateLessonDistractors({
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

  return Object.fromEntries(results);
}
