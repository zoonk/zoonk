import { describe, expect, it } from "vitest";
import { getLessonCheckModels } from "./lesson-check-models";

describe(getLessonCheckModels, () => {
  it("checks a lesson very likely read again with Sonnet, then Sol ahead of Flash, from another family", () => {
    expect(
      getLessonCheckModels({ reuse: "bounded", writerModel: "openai/gpt-6-sol" }),
    ).toStrictEqual({
      fallbackModels: ["google/gemini-3.8-flash"],
      model: "anthropic/claude-sonnet-5.5",
    });

    expect(
      getLessonCheckModels({ reuse: "bounded", writerModel: "anthropic/claude-opus-5.5" }),
    ).toStrictEqual({ fallbackModels: ["google/gemini-3.8-flash"], model: "openai/gpt-6.1-sol" });
  });

  it("checks a lesson that may serve one learner with Sonnet, then Flash ahead of Sol, from another family", () => {
    expect(
      (["library", "personal"] as const).map((reuse) =>
        getLessonCheckModels({ reuse, writerModel: "openai/gpt-6-sol" }),
      ),
    ).toStrictEqual([
      { fallbackModels: ["google/gemini-3.8-flash"], model: "anthropic/claude-sonnet-5.5" },
      { fallbackModels: ["google/gemini-3.8-flash"], model: "anthropic/claude-sonnet-5.5" },
    ]);

    expect(
      getLessonCheckModels({ reuse: "personal", writerModel: "anthropic/claude-opus-5.5" }),
    ).toStrictEqual({ fallbackModels: ["openai/gpt-6.1-sol"], model: "google/gemini-3.8-flash" });

    // A lesson Gemini wrote (a last draft after other families' were held back) never gets a
    // Gemini reviewer.
    expect(
      getLessonCheckModels({ reuse: "personal", writerModel: "google/gemini-3.8-flash" }),
    ).toStrictEqual({
      fallbackModels: ["openai/gpt-6.1-sol"],
      model: "anthropic/claude-sonnet-5.5",
    });
  });
});
