import { describe, expect, it } from "vitest";
import { buildImageProviderOptions, buildProviderOptions } from "./provider-options";

describe(buildProviderOptions, () => {
  it("adds provider order and reasoning effort for fallback-enabled models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        model: "openai/gpt-5.4",
        reasoningEffort: "high",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: {
        models: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
      },
      openai: { reasoningEffort: "high" },
    });
  });

  it("skips fallback models when fallback routing is disabled", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "google/gemini-3-flash",
        useFallback: false,
      }),
    ).toStrictEqual({
      gateway: { models: [], order: ["google", "vertex", "openai", "azure", "anthropic"] },
    });
  });

  it("adds the anthropic provider order for anthropic models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "anthropic/claude-opus-4.6",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
        order: ["anthropic", "vertex", "openai", "azure", "google"],
      },
    });
  });

  it("leaves provider order unset for unsupported model prefixes", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "xai/grok-4",
        useFallback: true,
      }),
    ).toStrictEqual({ gateway: { models: ["openai/gpt-5.4-mini"] } });
  });

  it("keeps provider order when fallback routing has no fallback models", () => {
    expect(
      buildProviderOptions({ fallbackModels: [], model: "openai/gpt-5.4", useFallback: true }),
    ).toStrictEqual({
      gateway: { models: [], order: ["openai", "azure", "google", "anthropic", "vertex"] },
    });
  });
});

describe(buildImageProviderOptions, () => {
  it("preserves the openai image settings", () => {
    expect(buildImageProviderOptions({ quality: "low" })).toStrictEqual({
      openai: { output_format: "webp", quality: "low" },
    });
  });
});
