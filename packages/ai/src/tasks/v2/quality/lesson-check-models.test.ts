import { describe, expect, it } from "vitest";
import { getLessonCheckModels } from "./lesson-check-models";

describe(getLessonCheckModels, () => {
  it("checks a lesson very likely read again with the strongest reviewer from another family", () => {
    expect(
      getLessonCheckModels({ reuse: "bounded", writerModel: "openai/gpt-6-sol" }),
    ).toStrictEqual({
      fallbackModels: ["google/gemini-3.8-flash"],
      model: "anthropic/claude-sonnet-5.5",
    });

    expect(
      getLessonCheckModels({ reuse: "bounded", writerModel: "anthropic/claude-opus-5.5" }),
    ).toStrictEqual({ fallbackModels: ["openai/gpt-6-sol"], model: "google/gemini-3.8-flash" });
  });

  it("checks a lesson that may serve one learner with the cheaper reviewer from another family", () => {
    expect(
      (["library", "personal"] as const).map((reuse) =>
        getLessonCheckModels({ reuse, writerModel: "openai/gpt-6-sol" }),
      ),
    ).toStrictEqual([
      { fallbackModels: ["anthropic/claude-sonnet-5.5"], model: "google/gemini-3.8-flash" },
      { fallbackModels: ["anthropic/claude-sonnet-5.5"], model: "google/gemini-3.8-flash" },
    ]);

    // A private course's lesson, written by Gemini, never gets a Gemini reviewer.
    expect(
      getLessonCheckModels({ reuse: "personal", writerModel: "google/gemini-3.8-flash" }),
    ).toStrictEqual({ fallbackModels: ["openai/gpt-6-sol"], model: "anthropic/claude-sonnet-5.5" });
  });
});
