import { generateActivityRomanization } from "@zoonk/ai/tasks/activities/language/romanization";
import { safeAsync } from "@zoonk/utils/error";
import { needsRomanization } from "@zoonk/utils/languages";

/**
 * Generates romanized (Latin-script) representations for a list of texts.
 *
 * This is the shared core for all romanization steps (vocabulary, reading, grammar).
 * It handles the language check, AI call, and result mapping so that each step file
 * only needs to extract its texts and handle step-specific streaming/validation.
 *
 * The steps also check `needsRomanization` before creating a stream (to avoid
 * streaming events for Roman-script languages). This function checks it again
 * as defense-in-depth.
 *
 * Returns `null` when the language uses Roman script (no romanization needed)
 * or when the AI call fails. The caller decides how to interpret `null`
 * (e.g., grammar returns it directly; vocabulary/reading convert to `{}`).
 */
export async function generateActivityRomanizations(params: {
  targetLanguage: string;
  texts: string[];
}): Promise<Record<string, string> | null> {
  const { targetLanguage, texts } = params;

  if (!needsRomanization(targetLanguage)) {
    return null;
  }

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts }),
  );

  if (error || !result?.data) {
    return null;
  }

  return Object.fromEntries(
    texts
      .map((text, index) => [text, result.data.romanizations[index]] as const)
      .filter((entry): entry is [string, string] => Boolean(entry[1])),
  );
}
