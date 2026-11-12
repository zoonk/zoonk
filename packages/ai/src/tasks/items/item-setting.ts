import { formatCast } from "../_utils/cast";
import { formatLocalContext } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";

/**
 * The `TARGET_LANGUAGE`, `LOCAL_CONTEXT` and `CAST` lines of an item prompt. A language goal's
 * questions happen where its taught variety is spoken, while their setup still addresses the
 * learner in `language`, so another language's register stays out.
 */
export function formatItemSetting({
  country,
  language,
  seed,
  targetLanguage,
}: {
  country: string | null;
  language: string;
  seed: string;
  targetLanguage?: string | null;
}): string {
  const place = targetLanguage
    ? { country: null, language: targetLanguage }
    : { country, language };

  const targetLanguageLine = targetLanguage
    ? `    TARGET_LANGUAGE: ${getPromptLanguageName({ language: targetLanguage, userLanguage: language })}\n`
    : "";

  return `${targetLanguageLine}${formatLocalContext({ ...place, register: place.language === language })}
    ${formatCast({ ...place, seed })}`;
}
