import { getTaughtRegion, getVarietyName } from "@zoonk/utils/language-regions";
import { getLanguageName } from "@zoonk/utils/languages";
import { getRegister } from "./language-context";

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

/**
 * A learner's country that lessons don't teach, as its variety in its own language ("Español
 * (Argentina)"). Null without one, or for the country lessons teach, which the language's own name
 * already says, so those prompts stay as they were.
 */
export function getPromptVarietyName({
  language,
  region,
}: {
  language: string;
  region?: string | null;
}): string | null {
  return region && region !== getTaughtRegion(language)
    ? getVarietyName({ language, region, userLanguage: language })
    : null;
}

export function getPromptLanguageName(params: {
  language: string;
  region?: string | null;
  userLanguage?: string;
}): string {
  return (
    getPromptVarietyName(params) ??
    PROMPT_LANGUAGE_NAMES[params.language] ??
    getFallbackLanguageName(params)
  );
}

export function getLanguagePromptContext(params: {
  targetLanguage: string;
  targetRegion?: string | null;
  userLanguage: string;
}) {
  return {
    targetLanguageName: getPromptLanguageName({
      language: params.targetLanguage,
      region: params.targetRegion,
      userLanguage: params.userLanguage,
    }),
    userLanguageName: getPromptLanguageName({ language: params.userLanguage }),
  };
}

/**
 * Fills `{{TARGET_LANGUAGE}}` and `{{LEARNER_LANGUAGE}}` with the names, so a rule names its
 * language: told only to look up a `LEARNER_LANGUAGE` input, GPT-6 Luna wrote an English learner's
 * text in another language. `{{LEARNER_REGISTER}}` is how text in the learner's language addresses
 * them. A prompt with no practiced language passes no `targetLanguage`.
 */
export function fillPromptLanguages({
  learnerLanguage,
  targetLanguage,
  template,
}: {
  learnerLanguage: string;
  targetLanguage?: string;
  template: string;
}): string {
  const learnerLanguageName = getPromptLanguageName({ language: learnerLanguage });

  const withLearner = template
    .replaceAll("{{LEARNER_LANGUAGE}}", () => learnerLanguageName)
    .replaceAll("{{LEARNER_REGISTER}}", () => getRegister(learnerLanguage));

  if (!targetLanguage) {
    return withLearner;
  }

  const targetLanguageName = getPromptLanguageName({
    language: targetLanguage,
    userLanguage: learnerLanguage,
  });

  return withLearner.replaceAll("{{TARGET_LANGUAGE}}", () => targetLanguageName);
}

function getFallbackLanguageName(params: { language: string; userLanguage?: string }): string {
  if (params.userLanguage) {
    return getLanguageName({ targetLanguage: params.language, userLanguage: params.userLanguage });
  }

  return getLanguageName({ targetLanguage: params.language });
}
