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

  it("doesn't fall back to the model a private scope already chose from the chain", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-6-luna", "anthropic/claude-haiku-5.5"],
        model: "openai/gpt-6-luna",
        useFallback: true,
      }).gateway.models,
    ).toStrictEqual(["anthropic/claude-haiku-5.5"]);
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
  it("runs background work at the flex tier", () => {
    expect(chooseServiceTier({ wait: "later" })).toBe("flex");
  });

  it("runs every call a learner waits on at the priority tier", () => {
    expect(chooseServiceTier({ wait: "learner" })).toBe("priority");
  });

  it("prepares content needed soon at the standard tier", () => {
    expect(chooseServiceTier({ wait: "soon" })).toBeUndefined();
  });
});

describe(buildImageProviderOptions, () => {
  it("lets shared Library pictures fall back to FLUX and Recraft, after Sunburst and MAI-Image", () => {
    expect(
      buildImageProviderOptions({
        promptTraining: true,
        quality: "low",
        size: "1024x1024",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: {
        models: [
          "openai/gpt-image-2.5-sunburst",
          "microsoft/mai-image-2.6",
          "bfl/flux-3-image",
          "recraft/recraft-v4.1-utility",
        ],
      },
      openai: { output_format: "webp", quality: "low" },
    });
  });

  it("leaves Recraft out of sizes it can't draw", () => {
    expect(
      buildImageProviderOptions({
        promptTraining: true,
        quality: "low",
        size: "1024x1280",
        useFallback: true,
      }).gateway.models,
    ).toStrictEqual([
      "openai/gpt-image-2.5-sunburst",
      "microsoft/mai-image-2.6",
      "bfl/flux-3-image",
    ]);
  });

  it("keeps pictures that can't train with providers that don't train on prompts", () => {
    expect(
      buildImageProviderOptions({
        promptTraining: false,
        quality: "medium",
        size: "1024x1024",
        useFallback: true,
      }),
    ).toStrictEqual({
      gateway: { models: ["openai/gpt-image-2.5-sunburst", "microsoft/mai-image-2.6"] },
      openai: { output_format: "webp", quality: "medium" },
    });
  });

  it("drops every fallback when an eval tests one model", () => {
    expect(
      buildImageProviderOptions({
        promptTraining: true,
        quality: "low",
        size: "1024x1024",
        useFallback: false,
      }).gateway.models,
    ).toStrictEqual([]);
  });
});
