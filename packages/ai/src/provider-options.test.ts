import { describe, expect, it } from "vitest";
import { buildImageProviderOptions, buildProviderOptions } from "./provider-options";

describe(buildProviderOptions, () => {
  it("adds provider order for fallback-enabled models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        model: "openai/gpt-6-sol",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: {
        models: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
      },
    });
  });

  it("skips fallback models when fallback routing is disabled", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-6-luna"],
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
        fallbackModels: ["openai/gpt-6-luna"],
        model: "anthropic/claude-opus-5.5",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: {
        models: ["openai/gpt-6-luna"],
        order: ["anthropic", "vertex", "openai", "azure", "google"],
      },
    });
  });

  it("leaves provider order unset for unsupported model prefixes", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-6-luna"],
        model: "xai/grok-4",
        useFallback: true,
      }),
    ).toStrictEqual({ gateway: { models: ["openai/gpt-6-luna"] } });
  });

  it("keeps provider order when fallback routing has no fallback models", () => {
    expect(
      buildProviderOptions({ fallbackModels: [], model: "openai/gpt-6-sol", useFallback: true }),
    ).toStrictEqual({
      gateway: { models: [], order: ["openai", "azure", "google", "anthropic", "vertex"] },
    });
  });
});

describe(buildImageProviderOptions, () => {
  it("adds caller-owned image fallback models while preserving the openai image settings", () => {
    expect(
      buildImageProviderOptions({
        fallbackModels: ["bfl/flux-kontext-max", "xai/grok-imagine-image"],
        quality: "low",
      }),
    ).toStrictEqual({
      gateway: { models: ["bfl/flux-kontext-max", "xai/grok-imagine-image"] },
      openai: { output_format: "webp", quality: "low" },
    });
  });
});
