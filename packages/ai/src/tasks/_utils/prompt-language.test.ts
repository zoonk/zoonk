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

/** Converted by hand; each leaves this list once it names its languages. */
const NOT_YET_CONVERTED = new Set([
  "courses/course-details.prompt.md",
  "curriculum/skill-graph.prompt.md",
  "goals/understand-goal.prompt.md",
  "grading/grade-typed-answer-language-practice.prompt.md",
  "grading/grade-typed-answer.prompt.md",
  "items/item-rules/language-goals.prompt.md",
  "language/alphabet-lesson.prompt.md",
  "language/assess-pronunciation.prompt.md",
  "language/check-level-test-questions.prompt.md",
  "language/check-sentence-orders.prompt.md",
  "language/conversation-feedback.prompt.md",
  "language/conversation-objectives.prompt.md",
  "language/exam-speaking-card.prompt.md",
  "language/explain-spoken-answer.prompt.md",
  "language/language-lesson-check.prompt.md",
  "language/language-lesson-fix.prompt.md",
  "language/language-lesson-respelling-en.prompt.md",
  "language/language-lesson-respelling-es.prompt.md",
  "language/language-lesson-respelling-pt.prompt.md",
  "language/language-lesson.prompt.md",
  "language/language-sentence-orders.prompt.md",
  "language/level-test-bank.prompt.md",
  "language/level-test-confirmations.prompt.md",
  "language/level-test-language-rules.prompt.md",
  "language/skill-levels.prompt.md",
  "language/speaking-score.prompt.md",
  "listening/write-listening-set.prompt.md",
  "memory/memory-extraction.prompt.md",
  "warm-up/write-warm-up-cards.prompt.md",
]);

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
    const pointing = promptsPointingAtALanguageInput();

    expect(pointing.filter((file) => !NOT_YET_CONVERTED.has(file))).toStrictEqual([]);
    expect([...NOT_YET_CONVERTED].filter((file) => !pointing.includes(file))).toStrictEqual([]);
  });
});
