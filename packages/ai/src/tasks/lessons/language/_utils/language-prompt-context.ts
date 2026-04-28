import { getLanguageName } from "@zoonk/utils/languages";

export function getLanguagePromptContext(params: { targetLanguage: string; userLanguage: string }) {
  return {
    targetLanguageName: getLanguageName({
      targetLanguage: params.targetLanguage,
      userLanguage: params.userLanguage,
    }),
    userLanguage: params.userLanguage,
  };
}
