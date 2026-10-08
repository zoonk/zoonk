import { toAiGenerationEvent } from "@zoonk/ai/ai-generation-event";
import { type AiGeneration } from "@zoonk/ai/ai-generation-sink";
import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerAiGenerationAnalytics } from "./ai-generations";

// PostHog is an external service; the mock records what would leave the server.
const posthogClient = vi.hoisted(() => ({ capture: vi.fn(), shutdown: vi.fn() }));

vi.mock("posthog-node", () => ({
  PostHog: vi.fn(
    class {
      capture = posthogClient.capture;
      shutdown = posthogClient.shutdown;
    },
  ),
}));

const generation: AiGeneration = {
  context: { distinctId: "user-id" },
  provenance: {
    generatedAt: "2026-10-06T12:00:00.000Z",
    latencyMs: 1500,
    model: "openai/gpt-6-luna",
    promptVersion: "version",
    provider: "openai",
    requestedModel: "openai/gpt-6-luna",
    runId: "run-1",
    usage: { inputTokens: 10, outputTokens: 5 },
  },
  task: "lesson-explanation",
};

/**
 * `@zoonk/ai` never calls a sink under tests, so this calls the registered
 * sink directly to check what the app would send.
 */
async function sendThroughRegisteredSink() {
  registerAiGenerationAnalytics();
  await globalThis.zoonkAiGenerationSinks?.get("posthog")?.(generation);
}

describe(registerAiGenerationAnalytics, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.zoonkAiGenerationSinks = undefined;
  });

  it("sends AI generations to PostHog and flushes before returning", async () => {
    await sendThroughRegisteredSink();

    expect(PostHog).toHaveBeenCalledExactlyOnceWith("project-token", {
      flushAt: 1,
      flushInterval: 0,
      host: "https://posthog.test",
    });

    expect(posthogClient.capture).toHaveBeenCalledExactlyOnceWith(toAiGenerationEvent(generation));
    expect(posthogClient.shutdown).toHaveBeenCalledOnce();
  });

  it("sends nothing when PostHog isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");

    await sendThroughRegisteredSink();

    expect(PostHog).not.toHaveBeenCalled();
  });
});
