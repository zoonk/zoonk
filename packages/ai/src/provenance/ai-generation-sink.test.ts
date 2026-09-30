import { afterEach, describe, expect, it, vi } from "vitest";
import { type AiGenerationEvent } from "./ai-generation-event";
import { captureAiGeneration, registerAiGenerationSink } from "./ai-generation-sink";

const event: AiGenerationEvent = {
  distinctId: "user-1",
  event: "$ai_generation",
  properties: { $ai_model: "openai/gpt-6-luna" },
};

/** Leaves the test runner's environment so the production path can be exercised. */
function stubProductionEnvironment() {
  vi.stubEnv("E2E_TESTING", "false");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("VITEST", "false");
}

describe(captureAiGeneration, () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    globalThis.zoonkAiGenerationSink = undefined;
  });

  it("sends nothing under tests even when a sink is registered", async () => {
    const sink = vi.fn(async () => {});
    registerAiGenerationSink(sink);

    await captureAiGeneration(event);

    expect(sink).not.toHaveBeenCalled();
  });

  it("sends the event to the registered sink outside tests", async () => {
    stubProductionEnvironment();
    const sink = vi.fn(async () => {});
    registerAiGenerationSink(sink);

    await captureAiGeneration(event);

    expect(sink).toHaveBeenCalledExactlyOnceWith(event);
  });

  it("does nothing when no app registered a sink", async () => {
    stubProductionEnvironment();

    await expect(captureAiGeneration(event)).resolves.toBeUndefined();
  });

  it("never fails the generation when the sink fails", async () => {
    stubProductionEnvironment();

    registerAiGenerationSink(async () => {
      throw new Error("PostHog is down");
    });

    await expect(captureAiGeneration(event)).resolves.toBeUndefined();
  });
});
