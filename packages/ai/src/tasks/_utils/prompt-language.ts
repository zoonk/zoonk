import { getLanguageName } from "@zoonk/utils/languages";

const PROMPT_LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "US English",
  es: "Español Latinoamericano",
  fr: "Français",
  pt: "Português Brasileiro",
};

/**
 * Converts language codes into the exact language name an AI prompt should see.
 * The app stores compact locale codes, but prompts need the intended language
 * name spelled out so every task follows the same output-language rule without
 * repeating code-to-dialect instructions in markdown.
 */
export function getPromptLanguageName(params: { language: string; userLanguage?: string }): string {
  return PROMPT_LANGUAGE_NAMES[params.language] ?? getFallbackLanguageName(params);
}

/**
 * Builds the language labels shared by language-learning tasks. These tasks
 * need both the language being learned and the learner's language, and this
 * keeps dialect naming consistent across vocabulary, sentences, translation,
 * pronunciation, and grammar user-content prompts.
 */
export function getLanguagePromptContext(params: { targetLanguage: string; userLanguage: string }) {
  return {
    targetLanguageName: getPromptLanguageName({
      language: params.targetLanguage,
      userLanguage: params.userLanguage,
    }),
    userLanguageName: getPromptLanguageName({ language: params.userLanguage }),
  };
}

/**
 * Keeps non-app language codes useful in prompts by using the platform language
 * name API. When a user language is known, the name is localized for that user;
 * otherwise it falls back to the language's native display name.
 */
function getFallbackLanguageName(params: { language: string; userLanguage?: string }): string {
  if (params.userLanguage) {
    return getLanguageName({ targetLanguage: params.language, userLanguage: params.userLanguage });
  }

  return getLanguageName({ targetLanguage: params.language });
}
