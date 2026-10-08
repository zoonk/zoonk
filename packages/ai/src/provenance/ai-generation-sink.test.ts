import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type AiGeneration,
  captureAiGeneration,
  registerAiGenerationSink,
} from "./ai-generation-sink";

const generation: AiGeneration = {
  provenance: {
    generatedAt: "2026-10-06T12:00:00.000Z",
    latencyMs: 100,
    model: "openai/gpt-6-luna",
    promptVersion: "version",
    provider: "openai",
    requestedModel: "openai/gpt-6-luna",
    runId: "run-1",
    usage: { inputTokens: 10, outputTokens: 5 },
  },
  task: "lesson-explanation",
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
    globalThis.zoonkAiGenerationSinks = undefined;
  });

  it("sends nothing under tests even when a sink is registered", async () => {
    const sink = vi.fn(async () => {});
    registerAiGenerationSink("analytics", sink);

    await captureAiGeneration(generation);

    expect(sink).not.toHaveBeenCalled();
  });

  it("sends the call to every registered sink outside tests", async () => {
    stubProductionEnvironment();
    const analytics = vi.fn(async () => {});
    const log = vi.fn();
    registerAiGenerationSink("analytics", analytics);
    registerAiGenerationSink("log", log);

    await captureAiGeneration(generation);

    expect(analytics).toHaveBeenCalledExactlyOnceWith(generation);
    expect(log).toHaveBeenCalledExactlyOnceWith(generation);
  });

  it("replaces a sink registered again under the same name, as a hot reload does", async () => {
    stubProductionEnvironment();
    const first = vi.fn();
    const second = vi.fn();
    registerAiGenerationSink("log", first);
    registerAiGenerationSink("log", second);

    await captureAiGeneration(generation);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("does nothing when no app registered a sink", async () => {
    stubProductionEnvironment();

    await expect(captureAiGeneration(generation)).resolves.toBeUndefined();
  });

  it("never fails the generation when a sink fails, and still reaches the others", async () => {
    stubProductionEnvironment();
    const log = vi.fn();

    registerAiGenerationSink("analytics", async () => {
      throw new Error("PostHog is down");
    });

    registerAiGenerationSink("log", log);

    await expect(captureAiGeneration(generation)).resolves.toBeUndefined();
    expect(log).toHaveBeenCalledOnce();
  });
});
