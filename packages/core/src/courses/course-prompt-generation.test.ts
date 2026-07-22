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
  it("accepts a pending learn prompt with a canonical title and core format", () => {
    expect(getCoursePromptGenerationError(generatableCorePrompt)).toBeNull();
  });

  it.each([
    ["missing canonical title", { ...generatableCorePrompt, canonicalTitle: null }],
    ["unsupported format", { ...generatableCorePrompt, courseFormat: "question" as const }],
    ["missing generation status", { ...generatableCorePrompt, generationStatus: null }],
    ["unsupported intent", { ...generatableCorePrompt, intent: "question" as const }],
  ])("rejects a prompt with %s", (_reason, prompt) => {
    expect(getCoursePromptGenerationError(prompt)).toBe("Course prompt is not generatable");
  });

  it("rejects a language prompt whose source and target languages match", () => {
    const prompt = {
      ...generatableCorePrompt,
      courseFormat: "language" as const,
      targetLanguage: "en",
    };

    expect(getCoursePromptGenerationError(prompt)).toBe(
      "Language course source and target languages must be different",
    );
  });
});
