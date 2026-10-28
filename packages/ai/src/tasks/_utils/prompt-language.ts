import { getLanguageName } from "@zoonk/utils/languages";

const PROMPT_LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "US English",
  es: "Español de España",
  fr: "Français",
  pt: "Português Brasileiro",
};

export function getPromptLanguageName(params: { language: string; userLanguage?: string }): string {
  return PROMPT_LANGUAGE_NAMES[params.language] ?? getFallbackLanguageName(params);
}

export function getLanguagePromptContext(params: { targetLanguage: string; userLanguage: string }) {
  return {
    targetLanguageName: getPromptLanguageName({
      language: params.targetLanguage,
      userLanguage: params.userLanguage,
    }),
    userLanguageName: getPromptLanguageName({ language: params.userLanguage }),
  };
}

function getFallbackLanguageName(params: { language: string; userLanguage?: string }): string {
  if (params.userLanguage) {
    return getLanguageName({ targetLanguage: params.language, userLanguage: params.userLanguage });
  }

  return getLanguageName({ targetLanguage: params.language });
}
