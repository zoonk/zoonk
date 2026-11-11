import { formatCast } from "../_utils/cast";
import { formatLocalContext, getRegister } from "../_utils/language-context";
import { getPromptLanguageName } from "../_utils/prompt-language";

/**
 * The `TARGET_LANGUAGE`, `LOCAL_CONTEXT`, `REGISTER` and `CAST` lines of an item prompt. A language
 * goal's questions happen where its language is spoken, while their setup still addresses the
 * learner in `language`, so the register is always `language`'s.
 */
export function formatItemSetting({
  language,
  seed,
  targetLanguage,
}: {
  language: string;
  seed: string;
  targetLanguage?: string | null;
}): string {
  const settingLanguage = targetLanguage ?? language;

  const targetLanguageLine = targetLanguage
    ? `    TARGET_LANGUAGE: ${getPromptLanguageName({ language: targetLanguage, userLanguage: language })}\n`
    : "";

  return `${targetLanguageLine}${formatLocalContext(settingLanguage, { register: false })}
    REGISTER: ${getRegister(language)}
    ${formatCast({ language: settingLanguage, seed })}`;
}
