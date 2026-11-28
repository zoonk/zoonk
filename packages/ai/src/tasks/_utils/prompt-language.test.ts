import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
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

const TASKS_DIR = path.join(import.meta.dirname, "..");

const SECOND_LANGUAGE =
  /\{\{(?:TARGET|LEARNER)_LANGUAGE\}\}|`(?:TARGET|PRACTICED|SCRIPT|LEARNER|FEEDBACK)_LANGUAGE`/u;

const LANGUAGE_INPUT = /`[A-Z_]*LANGUAGE[A-Z_]*`/u;

function promptsPointingAtALanguageInput(): string[] {
  return readdirSync(TASKS_DIR, { encoding: "utf8", recursive: true })
    .filter((file) => file.endsWith(".prompt.md"))
    .filter((file) => {
      const prompt = readFileSync(path.join(TASKS_DIR, file), "utf8");
      return SECOND_LANGUAGE.test(prompt) && LANGUAGE_INPUT.test(prompt);
    })
    .map((file) => file.split(path.sep).join("/"))
    .toSorted();
}

describe("prompts with two languages", () => {
  it("name each language instead of pointing at a language input", () => {
    expect(promptsPointingAtALanguageInput()).toStrictEqual([]);
  });
});
