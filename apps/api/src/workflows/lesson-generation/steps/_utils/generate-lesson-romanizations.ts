import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";

export async function generateLessonRomanizations(params: {
  targetLanguage: string;
  texts: string[];
}): Promise<Record<string, string>> {
  const { targetLanguage, texts } = params;

  if (!needsRomanization(targetLanguage)) {
    return {};
  }

  const { data: result, error } = await safeAsync(() =>
    generateLessonRomanization({ targetLanguage, texts }),
  );

  if (error || !result?.data) {
    throw error ?? new Error("romanizationFailed");
  }

  return Object.fromEntries(
    texts
      .map((text, index) => [text, result.data.romanizations[index]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
