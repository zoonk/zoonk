import { type LanguageModelUsage, type ProviderMetadata } from "ai";
import { describe, expect, it } from "vitest";
import {
  type TaskProvenance,
  buildTaskProvenance,
  combineTaskProvenance,
  sumLanguageModelUsage,
} from "./task-provenance";

const usage: LanguageModelUsage = {
  inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 10 },
  inputTokens: 10,
  outputTokenDetails: { reasoningTokens: 0, textTokens: 5 },
  outputTokens: 5,
  totalTokens: 15,
};

function createStep(gateway?: ProviderMetadata[string], stepUsage = usage) {
  return {
    model: { modelId: "openai/gpt-6-luna", provider: "gateway" },
    providerMetadata: gateway === undefined ? undefined : { gateway },
    response: { modelId: "openai/gpt-6-luna" },
    usage: stepUsage,
  };
}

function buildWithSteps(steps: ReturnType<typeof createStep>[]) {
  return buildTaskProvenance({
    generatedAt: "2026-09-26T12:00:00.000Z",
    generation: {
      finalStep: steps.at(-1) ?? createStep(),
      steps,
      usage: sumLanguageModelUsage(steps.map((step) => step.usage)),
    },
    latencyMs: 10,
    promptVersion: "version",
    runId: "run-1",
  });
}

describe(buildTaskProvenance, () => {
  it("prices each step at its served model and tier while keeping aggregate usage", () => {
    const stepUsage: LanguageModelUsage = {
      inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 1000 },
      inputTokens: 1000,
      outputTokenDetails: { reasoningTokens: 0, textTokens: 500 },
      outputTokens: 500,
      totalTokens: 1500,
    };

    const provenance = buildWithSteps([
      createStep({ serviceTier: "flex" }, stepUsage),
      createStep(
        {
          routing: {
            finalProvider: "vertex",
            modelAttempts: [{ canonicalSlug: "google/gemini-3.8-flash", success: true }],
          },
        },
        stepUsage,
      ),
    ]);

    // Luna flex: $0.000175; Gemini standard: $0.002625.
    expect(provenance.costUsd).toBeCloseTo(0.0028, 10);
    expect(provenance.model).toBe("openai/gpt-6-luna, google/gemini-3.8-flash");
    expect(provenance.provider).toBe("gateway, vertex");
    expect(provenance.serviceTier).toBe("mixed");
    expect(provenance.requestedModel).toBe("openai/gpt-6-luna");

    expect(provenance.usage).toMatchObject({
      inputTokens: 2000,
      outputTokens: 1000,
      totalTokens: 3000,
    });
  });

  it("prices mixed models correctly regardless of which model answers last", () => {
    const stepUsage: LanguageModelUsage = {
      ...usage,
      inputTokenDetails: { cacheReadTokens: 0, cacheWriteTokens: 0, noCacheTokens: 1000 },
      inputTokens: 1000,
      outputTokenDetails: { reasoningTokens: 0, textTokens: 500 },
      outputTokens: 500,
      totalTokens: 1500,
    };

    const luna = createStep(undefined, stepUsage);

    const gemini = createStep(
      { routing: { modelAttempts: [{ canonicalSlug: "google/gemini-3.8-flash", success: true }] } },
      stepUsage,
    );

    // Luna standard: $0.00035; Gemini standard: $0.002625.
    expect(buildWithSteps([luna, gemini]).costUsd).toBeCloseTo(0.002975, 10);
    expect(buildWithSteps([gemini, luna]).costUsd).toBeCloseTo(0.002975, 10);
  });

  it("prices different tiers independently even when the model stays the same", () => {
    const provenance = buildWithSteps([
      createStep({ serviceTier: "flex" }),
      createStep(),
      createStep({ serviceTier: "flex" }),
    ]);

    expect(provenance.costUsd).toBeCloseTo(7e-6, 10);
    expect(provenance.model).toBe("openai/gpt-6-luna");
    expect(provenance.serviceTier).toBe("mixed");
  });

  it("leaves the total unknown if any step ran on an unpriced model", () => {
    const provenance = buildWithSteps([
      createStep({
        routing: { modelAttempts: [{ canonicalSlug: "unpriced/model", success: true }] },
      }),
      createStep(),
    ]);

    expect(provenance.costUsd).toBeUndefined();
    expect(provenance.model).toBe("unpriced/model, openai/gpt-6-luna");
  });

  it("prices the call from its usage, whatever the gateway billed for our own key", () => {
    const provenance = buildWithSteps([createStep({ cost: "0" })]);

    // Luna: 10 input tokens at $0.10 and 5 output tokens at $0.50 per million.
    expect(provenance.costUsd).toBeCloseTo(3.5e-6, 10);
  });

  it("prices the call at the tier that served it", () => {
    const provenance = buildWithSteps([createStep({ serviceTier: "flex" })]);

    expect(provenance.serviceTier).toBe("flex");
    expect(provenance.costUsd).toBeCloseTo(1.75e-6, 10);
  });

  it("keeps the gateway's list-price estimate of every step as a cross-check", () => {
    const provenance = buildWithSteps([
      createStep({ cost: "0", marketCost: "0.25" }),
      createStep(),
      createStep({ cost: "0.5" }),
    ]);

    expect(provenance.gatewayCostUsd).toBe(0.75);
  });

  it("names the credential that paid for the call", () => {
    const provenance = buildWithSteps([
      createStep({
        routing: {
          modelAttempts: [
            {
              canonicalSlug: "openai/gpt-6-luna",
              providerAttempts: [{ credentialType: "byok", success: true }],
              success: true,
            },
          ],
        },
      }),
    ]);

    expect(provenance.credential).toBe("byok");
  });

  it("leaves the gateway's estimate unknown when no step reported one", () => {
    expect(buildWithSteps([createStep(), createStep()]).gatewayCostUsd).toBeUndefined();
  });
});

describe(sumLanguageModelUsage, () => {
  it("adds up every count, keeping one unknown only when no call reported it", () => {
    const unreported: LanguageModelUsage = {
      ...usage,
      inputTokenDetails: { cacheReadTokens: 4, cacheWriteTokens: undefined, noCacheTokens: 6 },
    };

    expect(
      sumLanguageModelUsage([
        {
          ...usage,
          inputTokenDetails: { ...usage.inputTokenDetails, cacheWriteTokens: undefined },
        },
        unreported,
      ]),
    ).toStrictEqual({
      inputTokenDetails: { cacheReadTokens: 4, cacheWriteTokens: undefined, noCacheTokens: 16 },
      inputTokens: 20,
      outputTokenDetails: { reasoningTokens: 0, textTokens: 10 },
      outputTokens: 10,
      totalTokens: 30,
    });
  });
});

function createRun(overrides: Partial<TaskProvenance>): TaskProvenance {
  return {
    costUsd: 0.1,
    generatedAt: "2026-09-28T10:00:00.000Z",
    latencyMs: 1000,
    model: "anthropic/claude-opus-5.5",
    promptVersion: "version",
    provider: "anthropic",
    requestedModel: "anthropic/claude-opus-5.5",
    runId: "run-1",
    usage: { inputTokens: 100, outputTokens: 50 },
    ...overrides,
  };
}

describe(combineTaskProvenance, () => {
  it("sums what calls made at the same time used and waits for the slowest", () => {
    const combined = combineTaskProvenance([
      createRun({}),
      createRun({ costUsd: 0.2, generatedAt: "2026-09-28T10:00:40.000Z", latencyMs: 40_000 }),
      createRun({ costUsd: undefined, latencyMs: 30_000, runId: "run-3" }),
    ]);

    expect(combined).toStrictEqual({
      costUsd: expect.closeTo(0.3),
      credential: undefined,
      gatewayCostUsd: undefined,
      generatedAt: "2026-09-28T10:00:40.000Z",
      latencyMs: 40_000,
      model: "anthropic/claude-opus-5.5",
      promptVersion: "version",
      provider: "anthropic",
      requestedModel: "anthropic/claude-opus-5.5",
      runId: "run-1",
      serviceTier: undefined,
      usage: {
        audioSeconds: undefined,
        cacheReadTokens: undefined,
        cacheWriteTokens: undefined,
        inputTokens: 300,
        outputTokens: 150,
        reasoningTokens: undefined,
        totalTokens: undefined,
      },
    });
  });

  it("names every model that answered when a fallback wrote some of the calls", () => {
    const combined = combineTaskProvenance([
      createRun({}),
      createRun({ model: "openai/gpt-6-luna", provider: "openai" }),
      createRun({}),
    ]);

    expect(combined).toMatchObject({
      model: "anthropic/claude-opus-5.5, openai/gpt-6-luna",
      provider: "anthropic, openai",
    });
  });

  it("adds up the audio of speech calls voicing one recording", () => {
    const speech = [4, 6.5].map((audioSeconds) =>
      createRun({ usage: { audioSeconds, inputTokens: 20 } }),
    );

    expect(combineTaskProvenance(speech).usage).toMatchObject({
      audioSeconds: 10.5,
      inputTokens: 40,
    });
  });

  it("refuses to make provenance up without a run", () => {
    expect(() => combineTaskProvenance([])).toThrow("at least one run");
  });
});
