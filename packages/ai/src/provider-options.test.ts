import { describe, expect, it } from "vitest";
import {
  buildImageProviderOptions,
  buildProviderOptions,
  chooseServiceTier,
} from "./provider-options";

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

  it("asks the gateway for the flex tier for background work", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["anthropic/claude-opus-5.5"],
        model: "openai/gpt-6-sol",
        serviceTier: "flex",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: {
        models: ["anthropic/claude-opus-5.5"],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
        serviceTier: "flex",
      },
    });
  });

  it("keeps provider order when fallback routing has no fallback models", () => {
    expect(
      buildProviderOptions({ fallbackModels: [], model: "openai/gpt-6-sol", useFallback: true }),
    ).toStrictEqual({
      gateway: { models: [], order: ["openai", "azure", "google", "anthropic", "vertex"] },
    });
  });
});

describe(chooseServiceTier, () => {
  it("runs work nobody waits on at the flex tier, whoever reads it", () => {
    expect(chooseServiceTier({ reuse: "bounded", wait: "later" })).toBe("flex");
    expect(chooseServiceTier({ reuse: "personal", wait: "later" })).toBe("flex");
  });

  it("pays for priority when a learner waits on content many learners will read", () => {
    expect(chooseServiceTier({ reuse: "bounded", wait: "learner" })).toBe("priority");
  });

  it("pays for priority on a small one-off call a learner waits on", () => {
    expect(chooseServiceTier({ reuse: "library", small: true, wait: "learner" })).toBe("priority");
    expect(chooseServiceTier({ reuse: "personal", small: true, wait: "learner" })).toBe("priority");
  });

  it("keeps the standard tier for interactive, personal and soon work", () => {
    expect(chooseServiceTier({ reuse: "library", wait: "learner" })).toBeUndefined();
    expect(chooseServiceTier({ reuse: "personal", wait: "learner" })).toBeUndefined();
    expect(chooseServiceTier({ reuse: "bounded", wait: "soon" })).toBeUndefined();
    expect(chooseServiceTier({ reuse: "personal", small: true, wait: "soon" })).toBeUndefined();
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
