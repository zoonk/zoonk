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
 * Returns an empty object when the language uses Roman script because there is
 * no AI work to do. AI call failures throw the original error so the owning
 * workflow step can be retried by Workflow instead of silently saving missing
 * romanization.
 */
export async function generateActivityRomanizations(params: {
  targetLanguage: string;
  texts: string[];
}): Promise<Record<string, string>> {
  const { targetLanguage, texts } = params;

  if (!needsRomanization(targetLanguage)) {
    return {};
  }

  const { data: result, error } = await safeAsync(() =>
    generateActivityRomanization({ targetLanguage, texts }),
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
