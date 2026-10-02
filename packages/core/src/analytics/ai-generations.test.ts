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

const event = {
  distinctId: "user-id",
  event: "$ai_generation" as const,
  properties: { $ai_model: "openai/gpt-6-luna", task: "lesson-explanation" },
};

/**
 * `@zoonk/ai` never calls a sink under tests, so this calls the registered
 * sink directly to check what the app would send.
 */
async function sendThroughRegisteredSink() {
  registerAiGenerationAnalytics();
  await globalThis.zoonkAiGenerationSink?.(event);
}

describe(registerAiGenerationAnalytics, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://posthog.test");
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "project-token");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.zoonkAiGenerationSink = undefined;
  });

  it("sends AI generations to PostHog and flushes before returning", async () => {
    await sendThroughRegisteredSink();

    expect(PostHog).toHaveBeenCalledExactlyOnceWith("project-token", {
      flushAt: 1,
      flushInterval: 0,
      host: "https://posthog.test",
    });

    expect(posthogClient.capture).toHaveBeenCalledExactlyOnceWith(event);
    expect(posthogClient.shutdown).toHaveBeenCalledOnce();
  });

  it("sends nothing when PostHog isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");

    await sendThroughRegisteredSink();

    expect(PostHog).not.toHaveBeenCalled();
  });
});
