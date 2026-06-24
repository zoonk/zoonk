import { describe, expect, it } from "vitest";
import { getLanguagePromptContext, getPromptLanguageName } from "./prompt-language";

describe(getPromptLanguageName, () => {
  it("expands supported app locale codes into dialect-specific prompt names", () => {
    expect(getPromptLanguageName({ language: "en" })).toBe("US English");
    expect(getPromptLanguageName({ language: "pt" })).toBe("Português Brasileiro");
    expect(getPromptLanguageName({ language: "es" })).toBe("Español Latinoamericano");
    expect(getPromptLanguageName({ language: "fr" })).toBe("Français");
    expect(getPromptLanguageName({ language: "de" })).toBe("Deutsch");
  });

  it("falls back to localized language names for languages outside the app locale set", () => {
    expect(getPromptLanguageName({ language: "ja", userLanguage: "en" })).toBe("Japanese");
    expect(getPromptLanguageName({ language: "ja", userLanguage: "pt" })).toBe("Japonês");
  });
});

describe(getLanguagePromptContext, () => {
  it("builds target and user language names for language-learning prompts", () => {
    expect(getLanguagePromptContext({ targetLanguage: "ja", userLanguage: "pt" })).toStrictEqual({
      targetLanguageName: "Japonês",
      userLanguageName: "Português Brasileiro",
    });
  });
});
