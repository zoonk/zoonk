import { describe, expect, test } from "vitest";
import { buildProviderOptions } from "./provider-options";

describe(buildProviderOptions, () => {
  test("adds the openai provider order and reasoning effort for openai models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        model: "openai/gpt-5.4",
        reasoningEffort: "high",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
      },
      openai: { reasoningEffort: "high" },
    });
  });

  test("adds the google provider order without openai-specific options", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "google/gemini-3-flash",
        useFallback: false,
      }),
    ).toEqual({
      gateway: {
        models: [],
        order: ["google", "vertex", "openai", "azure", "anthropic"],
      },
    });
  });

  test("adds the anthropic provider order for anthropic models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "anthropic/claude-opus-4.6",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
        order: ["anthropic", "vertex", "openai", "azure", "google"],
      },
    });
  });

  test("leaves provider order unset for unsupported model prefixes", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "xai/grok-4",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
      },
    });
  });
});
