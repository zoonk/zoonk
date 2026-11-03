import { describe, expect, it } from "vitest";
import { getWarmUpCheckModels } from "./warm-up-check-models";

describe(getWarmUpCheckModels, () => {
  it("checks cards with reviewers from families other than the model that wrote them", () => {
    expect(
      ["openai/gpt-6-luna", "google/gemini-3.5-flash-lite", "anthropic/claude-haiku-5.5"].map(
        (writerModel) => getWarmUpCheckModels(writerModel),
      ),
    ).toStrictEqual([
      { fallbackModels: ["anthropic/claude-sonnet-5.5"], model: "google/gemini-3.8-flash" },
      { fallbackModels: ["anthropic/claude-sonnet-5.5"], model: "openai/gpt-6-luna" },
      { fallbackModels: ["openai/gpt-6-luna"], model: "google/gemini-3.8-flash" },
    ]);
  });
});
