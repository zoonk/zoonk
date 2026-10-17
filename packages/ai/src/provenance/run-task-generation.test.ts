import { getPromptVersion } from "@zoonk/utils/prompt-version";
import { generateText } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { runTaskGeneration } from "./run-task-generation";

const REQUESTED_MODEL = "openai/gpt-6-sol";
const SYSTEM_PROMPT = "You write short lessons.";

type ModelGenerateResult = Awaited<ReturnType<MockLanguageModelV4["doGenerate"]>>;

/**
 * Mirrors what `@ai-sdk/gateway` returns from `doGenerate`: the gateway body is
 * spread in, then `response` is replaced by headers and body only, so the AI
 * SDK never sees a response model id from the gateway.
 */
function createGatewayResult(
  providerMetadata?: ModelGenerateResult["providerMetadata"],
): ModelGenerateResult {
  return {
    content: [{ text: "A lesson", type: "text" }],
    finishReason: { raw: "stop", unified: "stop" },
    providerMetadata,
    response: { body: {}, headers: {} },
    usage: {
      inputTokens: { cacheRead: 300, cacheWrite: 20, noCache: 680, total: 1000 },
      outputTokens: { reasoning: 150, text: 250, total: 400 },
    },
    warnings: [],
  };
}

function runWithModel(model: MockLanguageModelV4) {
  return runTaskGeneration({
    generate: () => generateText({ instructions: SYSTEM_PROMPT, model, prompt: "Photosynthesis" }),
    systemPrompt: SYSTEM_PROMPT,
    task: "lesson-explanation",
  });
}

describe(runTaskGeneration, () => {
  it("reports the fallback model that answered when the requested model failed", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: createGatewayResult({
        gateway: {
          cost: "0.0125",
          generationId: "gen_01",
          routing: {
            canonicalSlug: REQUESTED_MODEL,
            finalProvider: "anthropic",
            modelAttempts: [
              { canonicalSlug: REQUESTED_MODEL, modelId: "openai:gpt-6-sol", success: false },
              {
                canonicalSlug: "anthropic/claude-opus-5.5",
                modelId: "anthropic:claude-opus-5.5",
                success: true,
              },
            ],
            originalModelId: REQUESTED_MODEL,
          },
        },
      }),
      modelId: REQUESTED_MODEL,
      provider: "gateway",
    });

    const { provenance, result } = await runWithModel(model);

    expect(result.text).toBe("A lesson");
    expect(result.finalStep.response.modelId).toBe(REQUESTED_MODEL);

    expect(provenance).toStrictEqual({
      // Opus answered: 680 uncached, 300 cached and 20 written input tokens, 400 output tokens.
      costUsd: expect.closeTo(1.088e-2, 8),
      credential: undefined,
      gatewayCostUsd: 0.0125,
      generatedAt: expect.any(String),
      latencyMs: expect.any(Number),
      model: "anthropic/claude-opus-5.5",
      promptVersion: getPromptVersion({ systemPrompt: SYSTEM_PROMPT }),
      provider: "anthropic",
      requestedModel: REQUESTED_MODEL,
      runId: expect.stringMatching(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u),
      serviceTier: undefined,
      usage: {
        cacheReadTokens: 300,
        cacheWriteTokens: 20,
        inputTokens: 1000,
        outputTokens: 400,
        reasoningTokens: 150,
        totalTokens: 1400,
      },
    });

    expect(Number.isNaN(Date.parse(provenance.generatedAt))).toBe(false);
    expect(provenance.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("gives every run its own id", async () => {
    const model = new MockLanguageModelV4({ doGenerate: createGatewayResult() });

    const [first, second] = await Promise.all([runWithModel(model), runWithModel(model)]);

    expect(first.provenance.runId).not.toBe(second.provenance.runId);
  });

  it("uses the provider's response model when no gateway routing is reported", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: {
        ...createGatewayResult(),
        response: { id: "response-id", modelId: "gpt-6-sol-2026-09-22", timestamp: new Date() },
      },
      modelId: "gpt-6-sol",
      provider: "openai.responses",
    });

    const { provenance } = await runWithModel(model);

    expect(provenance).toMatchObject({
      costUsd: undefined,
      model: "gpt-6-sol-2026-09-22",
      provider: "openai.responses",
      requestedModel: "gpt-6-sol",
    });
  });

  it("keeps the readable gateway fields when others are malformed", async () => {
    const model = new MockLanguageModelV4({
      doGenerate: createGatewayResult({
        gateway: {
          cost: "not a number",
          routing: { finalProvider: "vertex", modelAttempts: [{ success: "yes" }] },
        },
      }),
      modelId: REQUESTED_MODEL,
      provider: "gateway",
    });

    const { provenance } = await runWithModel(model);

    expect(provenance).toMatchObject({
      gatewayCostUsd: undefined,
      model: REQUESTED_MODEL,
      provider: "vertex",
      requestedModel: REQUESTED_MODEL,
    });
  });
});
