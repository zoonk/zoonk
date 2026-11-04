import { describe, expect, it } from "vitest";
import {
  fillPromptLanguages,
  getLanguagePromptContext,
  getPromptLanguageName,
} from "./prompt-language";

describe(getPromptLanguageName, () => {
  it("falls back to localized language names for languages outside the app locale set", () => {
    expect(getPromptLanguageName({ language: "ar", userLanguage: "en" })).toBe("Arabic");
    expect(getPromptLanguageName({ language: "ar", userLanguage: "pt" })).toBe("Árabe");
  });
});

describe(getLanguagePromptContext, () => {
  it("builds target and user language names for language-learning prompts", () => {
    expect(getLanguagePromptContext({ targetLanguage: "ar", userLanguage: "pt" })).toStrictEqual({
      targetLanguageName: "Árabe",
      userLanguageName: "Português Brasileiro",
    });
  });
});

describe(fillPromptLanguages, () => {
  it("names both languages wherever the prompt mentions them", () => {
    expect(
      fillPromptLanguages({
        learnerLanguage: "en",
        targetLanguage: "es",
        template:
          "Talk in {{TARGET_LANGUAGE}}. Title in {{LEARNER_LANGUAGE}}, label in {{TARGET_LANGUAGE}}.",
      }),
    ).toBe("Talk in Español de México. Title in US English, label in Español de México.");
  });
});
