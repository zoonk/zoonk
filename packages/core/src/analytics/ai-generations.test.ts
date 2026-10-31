import { toAiGenerationEvent } from "@zoonk/ai/ai-generation-event";
import { type AiGeneration } from "@zoonk/ai/ai-generation-sink";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { POSTHOG_SYSTEM_DISTINCT_ID } from "@zoonk/utils/posthog";
import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerAiGenerationAnalytics } from "./ai-generations";

const posthogClient = {
  capture: vi.fn<(event: { distinctId: string; properties: Record<string, unknown> }) => void>(),
  shutdown: vi.fn(),
};

class TestPostHog {
  capture = posthogClient.capture;
  shutdown = posthogClient.shutdown;
}

const generation: AiGeneration = {
  context: {},
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

async function sendThroughRegisteredSink(sent: AiGeneration = generation) {
  registerAiGenerationAnalytics();
  await globalThis.zoonkAiGenerationSinks?.get("posthog")?.(sent);
}

async function learnerGeneration(profile: { birthYear?: number; shareUsageData?: boolean }) {
  const user = await userFixture();
  await learningProfileFixture({ ...profile, userId: user.id });

  return {
    ...generation,
    context: { distinctId: user.id, goalId: "goal-id", traceId: "trace-1" },
  } satisfies AiGeneration;
}

function sentEvent() {
  const [captured] = posthogClient.capture.mock.calls[0] ?? [];
  return captured;
}

describe(registerAiGenerationAnalytics, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(PostHog).mockImplementation(TestPostHog as never);
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

  it("names an adult learner as the person behind the generation", async () => {
    const sent = await learnerGeneration({ birthYear: 1990 });

    await sendThroughRegisteredSink(sent);

    expect(posthogClient.capture).toHaveBeenCalledExactlyOnceWith(toAiGenerationEvent(sent));
  });

  it("keeps a minor's generation without a person profile", async () => {
    const sent = await learnerGeneration({ birthYear: new Date().getUTCFullYear() - 15 });

    await sendThroughRegisteredSink(sent);

    expect(sentEvent()).toMatchObject({
      distinctId: sent.context.distinctId,
      properties: { $process_person_profile: false },
    });
  });

  it("counts a generation for a learner who turned usage data off as system work", async () => {
    const sent = await learnerGeneration({ birthYear: 1990, shareUsageData: false });

    await sendThroughRegisteredSink(sent);

    expect(sentEvent()).toMatchObject({
      distinctId: POSTHOG_SYSTEM_DISTINCT_ID,
      properties: { $ai_trace_id: "trace-1", $process_person_profile: false },
    });

    expect(sentEvent()?.properties).not.toHaveProperty("goal_id");
  });

  it("sends nothing when PostHog isn't configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "");

    await sendThroughRegisteredSink();

    expect(PostHog).not.toHaveBeenCalled();
  });
});
