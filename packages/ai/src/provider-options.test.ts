import { describe, expect, test } from "vitest";
import { buildImageProviderOptions, buildProviderOptions } from "./provider-options";

describe(buildProviderOptions, () => {
  test("adds provider order, default-model tags, and reasoning effort for fallback-enabled openai models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        model: "openai/gpt-5.4",
        reasoningEffort: "high",
        taskName: "activity-explanation",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
        tags: ["task:activity-explanation", "default-model:openai/gpt-5.4"],
      },
      openai: { reasoningEffort: "high" },
    });
  });

  test("skips reporting tags when fallback routing is disabled", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "google/gemini-3-flash",
        taskName: "activity-vocabulary",
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
        taskName: "activity-story-steps",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
        order: ["anthropic", "vertex", "openai", "azure", "google"],
        tags: ["task:activity-story-steps", "default-model:anthropic/claude-opus-4.6"],
      },
    });
  });

  test("leaves provider order unset for unsupported model prefixes", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "xai/grok-4",
        taskName: "course-description",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
        tags: ["task:course-description", "default-model:xai/grok-4"],
      },
    });
  });

  test("still adds reporting tags when fallback tracking is enabled without fallback models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: [],
        model: "openai/gpt-5.4",
        taskName: "activity-story-steps",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: [],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
        tags: ["task:activity-story-steps", "default-model:openai/gpt-5.4"],
      },
    });
  });
});

describe(buildImageProviderOptions, () => {
  test("adds gateway reporting tags while preserving the openai image settings", () => {
    expect(
      buildImageProviderOptions({
        model: "openai/gpt-image-1.5",
        quality: "low",
        taskName: "course-thumbnail",
      }),
    ).toEqual({
      gateway: {
        tags: ["task:course-thumbnail", "default-model:openai/gpt-image-1.5"],
      },
      openai: {
        output_format: "webp",
        quality: "low",
      },
    });
  });
});
