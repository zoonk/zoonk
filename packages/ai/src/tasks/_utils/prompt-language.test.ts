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

  it("names a country's variety in its own language", () => {
    expect(getPromptLanguageName({ language: "es", region: "AR" })).toBe("Español (Argentina)");
    expect(getPromptLanguageName({ language: "pt", region: "PT" })).toBe("Português (Portugal)");

    expect(getPromptLanguageName({ language: "en", region: "GB" })).toBe(
      "English (United Kingdom)",
    );
  });

  it("keeps the language's name without a country or for the one lessons teach", () => {
    expect(getPromptLanguageName({ language: "es", region: null })).toBe("Español de México");
    expect(getPromptLanguageName({ language: "es", region: "MX" })).toBe("Español de México");
    expect(getPromptLanguageName({ language: "en", region: "US" })).toBe("US English");
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

  it("names only the learner's language when nothing is practiced", () => {
    expect(
      fillPromptLanguages({ learnerLanguage: "pt", template: "Answer in {{LEARNER_LANGUAGE}}." }),
    ).toBe("Answer in Português Brasileiro.");
  });
});
