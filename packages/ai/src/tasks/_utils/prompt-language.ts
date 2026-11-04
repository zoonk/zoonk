import { getLanguageName } from "@zoonk/utils/languages";

const PROMPT_LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch",
  en: "US English",
  es: "Español de México",
  fr: "Français",
  it: "Italiano",
  ja: "日本語",
  ko: "한국어",
  pl: "Polski",
  pt: "Português Brasileiro",
  tr: "Türkçe",
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

/**
 * Fills `{{TARGET_LANGUAGE}}` and `{{LEARNER_LANGUAGE}}` with the names, so a rule names its
 * language: told only to look up a `LEARNER_LANGUAGE` input, GPT-6 Luna wrote an English learner's
 * text in another language.
 */
export function fillPromptLanguages({
  learnerLanguage,
  targetLanguage,
  template,
}: {
  learnerLanguage: string;
  targetLanguage: string;
  template: string;
}): string {
  const { targetLanguageName, userLanguageName } = getLanguagePromptContext({
    targetLanguage,
    userLanguage: learnerLanguage,
  });

  return template
    .replaceAll("{{TARGET_LANGUAGE}}", () => targetLanguageName)
    .replaceAll("{{LEARNER_LANGUAGE}}", () => userLanguageName);
}

function getFallbackLanguageName(params: { language: string; userLanguage?: string }): string {
  if (params.userLanguage) {
    return getLanguageName({ targetLanguage: params.language, userLanguage: params.userLanguage });
  }

  return getLanguageName({ targetLanguage: params.language });
}
