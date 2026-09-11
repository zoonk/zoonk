import { describe, expect, it } from "vitest";
import { getCoursePromptGenerationError } from "./course-prompt-generation";

const generatableCorePrompt = {
  canonicalTitle: "Linear Algebra",
  courseFormat: "core" as const,
  generationStatus: "pending" as const,
  intent: "learn" as const,
  language: "en",
  targetLanguage: null,
};

describe(getCoursePromptGenerationError, () => {
  it.each(["coding", "core", "practical"] as const)(
    "accepts a pending learn prompt with a canonical title and %s format",
    (courseFormat) => {
      expect(getCoursePromptGenerationError({ ...generatableCorePrompt, courseFormat })).toBeNull();
    },
  );

  it.each([
    ["missing canonical title", { ...generatableCorePrompt, canonicalTitle: null }],
    [
      "unsupported instrument format",
      { ...generatableCorePrompt, courseFormat: "instrument" as const },
    ],
    ["unsupported prompt format", { ...generatableCorePrompt, courseFormat: "question" as const }],
    ["missing generation status", { ...generatableCorePrompt, generationStatus: null }],
    ["unsupported intent", { ...generatableCorePrompt, intent: "question" as const }],
  ])("rejects a prompt with %s", (_reason, prompt) => {
    expect(getCoursePromptGenerationError(prompt)).toBe("Course prompt is not generatable");
  });

  it.each([
    ["en", "en"],
    ["en-US", "en"],
    ["EN", "en"],
    ["ja-JP", "ja"],
    ["zh-Hant-TW", "zh"],
    ["JA-jp", "ja"],
  ])("rejects a language prompt whose %s source matches its target", (language, targetLanguage) => {
    const prompt = {
      ...generatableCorePrompt,
      courseFormat: "language" as const,
      language,
      targetLanguage,
    };

    expect(getCoursePromptGenerationError(prompt)).toBe(
      "Language course source and target languages must be different",
    );
  });

  it.each([
    ["ja-JP", "ko"],
    ["zh-Hant-TW", "ja"],
  ])("accepts %s language courses with a different %s target", (language, targetLanguage) => {
    expect(
      getCoursePromptGenerationError({
        ...generatableCorePrompt,
        courseFormat: "language",
        language,
        targetLanguage,
      }),
    ).toBeNull();
  });
});
