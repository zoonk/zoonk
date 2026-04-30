import { afterEach, describe, expect, it, vi } from "vitest";
import { buildImageProviderOptions, buildProviderOptions } from "./provider-options";

describe(buildProviderOptions, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips reporting tags by default even for fallback-enabled models", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        model: "openai/gpt-5.4",
        reasoningEffort: "high",
        taskName: "lesson-explanation",
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

  it("adds provider order, default-model tags, and reasoning effort when gateway tags are enabled", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildProviderOptions({
        fallbackModels: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        model: "openai/gpt-5.4",
        reasoningEffort: "high",
        taskName: "lesson-explanation",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["google/gemini-3-flash", "anthropic/claude-haiku-4.5"],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
        tags: ["task:lesson-explanation", "default-model:openai/gpt-5.4"],
      },
      openai: { reasoningEffort: "high" },
    });
  });

  it("skips reporting tags when fallback routing is disabled", () => {
    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "google/gemini-3-flash",
        taskName: "lesson-vocabulary",
        useFallback: false,
      }),
    ).toEqual({
      gateway: { models: [], order: ["google", "vertex", "openai", "azure", "anthropic"] },
    });
  });

  it("adds the anthropic provider order for anthropic models", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildProviderOptions({
        fallbackModels: ["openai/gpt-5.4-mini"],
        model: "anthropic/claude-opus-4.6",
        taskName: "lesson-practice",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: ["openai/gpt-5.4-mini"],
        order: ["anthropic", "vertex", "openai", "azure", "google"],
        tags: ["task:lesson-practice", "default-model:anthropic/claude-opus-4.6"],
      },
    });
  });

  it("leaves provider order unset for unsupported model prefixes", () => {
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

  it("still adds reporting tags when fallback tracking is enabled without fallback models", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildProviderOptions({
        fallbackModels: [],
        model: "openai/gpt-5.4",
        taskName: "lesson-practice",
        useFallback: true,
      }),
    ).toEqual({
      gateway: {
        models: [],
        order: ["openai", "azure", "google", "anthropic", "vertex"],
        tags: ["task:lesson-practice", "default-model:openai/gpt-5.4"],
      },
    });
  });
});

describe(buildImageProviderOptions, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("skips gateway reporting tags by default while preserving the openai image settings", () => {
    expect(
      buildImageProviderOptions({
        model: "openai/gpt-image-2",
        quality: "low",
        taskName: "course-thumbnail",
      }),
    ).toEqual({ gateway: {}, openai: { output_format: "webp", quality: "low" } });
  });

  it("adds gateway reporting tags for image tasks when enabled", () => {
    vi.stubEnv("ENABLE_AI_GATEWAY_TAGS", "true");

    expect(
      buildImageProviderOptions({
        model: "openai/gpt-image-2",
        quality: "low",
        taskName: "course-thumbnail",
      }),
    ).toEqual({
      gateway: { tags: ["task:course-thumbnail", "default-model:openai/gpt-image-2"] },
      openai: { output_format: "webp", quality: "low" },
    });
  });
});
