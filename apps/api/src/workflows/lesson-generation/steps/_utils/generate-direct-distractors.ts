import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { type DistractorShape, sanitizeDistractors } from "@zoonk/utils/distractors";
import { safeAsync } from "@zoonk/utils/error";

type DistractorEntry = {
  input: string;
  key: string;
};

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
