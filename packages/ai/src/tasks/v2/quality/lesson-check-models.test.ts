import { describe, expect, it } from "vitest";
import { getLessonCheckModels } from "./lesson-check-models";

describe(getLessonCheckModels, () => {
  it("picks a reviewer and fallbacks from families other than the writer's", () => {
    expect(getLessonCheckModels("openai/gpt-6-sol")).toStrictEqual({
      fallbackModels: ["google/gemini-3.8-flash"],
      model: "anthropic/claude-opus-5.5",
    });

    expect(getLessonCheckModels("anthropic/claude-opus-5.5")).toStrictEqual({
      fallbackModels: ["openai/gpt-6-sol"],
      model: "google/gemini-3.8-flash",
    });

    expect(getLessonCheckModels("google/gemini-3.8-flash")).toStrictEqual({
      fallbackModels: ["openai/gpt-6-sol"],
      model: "anthropic/claude-opus-5.5",
    });
  });
});
