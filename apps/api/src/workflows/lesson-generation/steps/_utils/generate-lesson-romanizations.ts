import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { needsRomanization } from "@zoonk/utils/languages";

/**
 * Pairs each generated romanization with its source text. The AI task schema
 * enforces one romanization per input text, but TypeScript still treats indexed
 * array access as possibly missing, so this keeps the workflow result typed as
 * a complete text-to-romanization map.
 */
function pairTextsWithRomanizations({
  romanizations,
  texts,
}: {
  romanizations: string[];
  texts: string[];
}): [string, string][] {
  return texts.map((text, index) => {
    const romanization = romanizations[index];

    if (!romanization) {
      throw new Error("romanizationFailed");
    }

    return [text, romanization];
  });
}

export async function generateLessonRomanizations(params: {
  targetLanguage: string;
  texts: string[];
}): Promise<Record<string, string>> {
  const { targetLanguage, texts } = params;

  if (!needsRomanization(targetLanguage)) {
    return {};
  }

  const result = await generateLessonRomanization({ targetLanguage, texts });

  return Object.fromEntries(
    pairTextsWithRomanizations({ romanizations: result.data.romanizations, texts }),
  );
}
