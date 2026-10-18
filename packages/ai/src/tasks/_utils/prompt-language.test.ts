import { describe, expect, it } from "vitest";
import { getLanguagePromptContext, getPromptLanguageName } from "./prompt-language";

describe(getPromptLanguageName, () => {
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
