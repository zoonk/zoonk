import { afterEach, describe, expect, test, vi } from "vitest";
import { buildImageProviderOptions, buildProviderOptions } from "./provider-options";

describe(buildProviderOptions, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("skips reporting tags by default even for fallback-enabled models", () => {
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
      },
      openai: { reasoningEffort: "high" },
    });
  });

  test("adds provider order, default-model tags, and reasoning effort when gateway tags are enabled", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

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
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "anthropic/claude-opus-4.6",
        taskName: "activity-practice",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
        order: ["anthropic", "vertex", "openai", "azure", "google"],
        tags: ["task:activity-practice", "default-model:anthropic/claude-opus-4.6"],
      },
    });
  });

  test("leaves provider order unset for unsupported model prefixes", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

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
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildProviderOptions({
        fallbackModels: [],
        model: "openai/gpt-5.4",
        taskName: "activity-practice",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: [],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
        tags: ["task:activity-practice", "default-model:openai/gpt-5.4"],
      },
    });
  });
});

describe(buildImageProviderOptions, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("skips gateway reporting tags by default while preserving the openai image settings", () => {
    expect(
      buildImageProviderOptions({
        model: "openai/gpt-image-2",
        quality: "low",
        taskName: "course-thumbnail",
      }),
    ).toEqual({
      gateway: {},
      openai: {
        output_format: "webp",
        quality: "low",
      },
    });
  });

  test("adds gateway reporting tags for image tasks when enabled", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildImageProviderOptions({
        model: "openai/gpt-image-2",
        quality: "low",
        taskName: "course-thumbnail",
      }),
    ).toEqual({
      gateway: {
        tags: ["task:course-thumbnail", "default-model:openai/gpt-image-2"],
      },
      openai: {
        output_format: "webp",
        quality: "low",
      },
    });
  });
});
