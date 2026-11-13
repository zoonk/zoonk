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

  it.each([
    ["openai/gpt-6.1-sol", "moonshotai/kimi-k3.1-pro"],
    ["moonshotai/kimi-k3.1-pro", "openai/gpt-6.1-terra"],
  ])("excludes both writer families for %s then %s", (plan, script) => {
    expect(getLessonCheckModels({ writerModels: [plan, script] })).toStrictEqual({
      fallbackModels: [],
      model: "anthropic/claude-opus-5.5",
    });
  });

  it("uses the full pool for an all-Kimi case", () => {
    expect(
      getLessonCheckModels({
        writerModels: ["moonshotai/kimi-k3.1-pro", "moonshotai/kimi-k3.1-pro"],
      }),
    ).toStrictEqual({
      fallbackModels: ["openai/gpt-6.1-sol", "anthropic/claude-opus-5.5"],
      model: "openai/gpt-6-astra",
    });
  });

  it("keeps the alphabet chain", () => {
    expect(
      getLessonCheckModels({ kind: "alphabet", writerModel: "openai/gpt-6-luna" }),
    ).toStrictEqual({
      fallbackModels: ["google/gemini-3.8-flash"],
      model: "anthropic/claude-sonnet-5.5",
    });
  });

  it("keeps OpenAI out of the language chain", () => {
    expect(
      getLessonCheckModels({ kind: "language", writerModel: "openai/gpt-6.1-terra" }),
    ).toStrictEqual({
      fallbackModels: ["google/gemini-3.8-flash"],
      model: "anthropic/claude-sonnet-5.5",
    });
  });
});
