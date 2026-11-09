import { describe, expect, it } from "vitest";
import { getLessonCheckModels } from "./lesson-check-models";

describe(getLessonCheckModels, () => {
  it("uses Astra then Sol for Opus, and Opus for OpenAI writers", () => {
    expect(getLessonCheckModels({ writerModel: "anthropic/claude-opus-5.5" })).toStrictEqual({
      fallbackModels: ["openai/gpt-6.1-sol"],
      model: "openai/gpt-6-astra",
    });

    expect(getLessonCheckModels({ writerModel: "openai/gpt-6.1-terra" })).toStrictEqual({
      fallbackModels: [],
      model: "anthropic/claude-opus-5.5",
    });
  });

  it("keeps the alphabet chain", () => {
    expect(
      getLessonCheckModels({ alphabet: true, writerModel: "openai/gpt-6-luna" }),
    ).toStrictEqual({
      fallbackModels: ["google/gemini-3.8-flash"],
      model: "anthropic/claude-sonnet-5.5",
    });
  });
});
