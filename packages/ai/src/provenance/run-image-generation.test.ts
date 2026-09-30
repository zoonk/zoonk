import { generateImage } from "ai";
import { MockImageModelV4 } from "ai/test";
import { describe, expect, it } from "vitest";
import { getPromptVersion } from "./prompt-version";
import { runImageTaskGeneration } from "./run-image-generation";

const REQUESTED_MODEL = "openai/gpt-image-2.5-flare";
const TEMPLATE = "Draw one flat illustration.";

const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

type ImageGenerateResult = Awaited<ReturnType<MockImageModelV4["doGenerate"]>>;

function imageModel(providerMetadata?: ImageGenerateResult["providerMetadata"]) {
  return new MockImageModelV4({
    doGenerate: () =>
      Promise.resolve({
        images: [PIXEL],
        providerMetadata,
        response: { headers: {}, modelId: REQUESTED_MODEL, timestamp: new Date() },
        usage: { inputTokens: 120, outputTokens: 272, totalTokens: 392 },
        warnings: [],
      }),
  });
}

function runWithModel(model: MockImageModelV4) {
  return runImageTaskGeneration({
    generate: () => generateImage({ model, prompt: "An atom" }),
    promptVersion: "style-v1",
    requestedModel: REQUESTED_MODEL,
    systemPrompt: TEMPLATE,
    task: "lesson-image",
  });
}

describe(runImageTaskGeneration, () => {
  it("reports the fallback model that drew the image, its cost and tokens", async () => {
    const model = imageModel({
      gateway: {
        cost: "0.0082",
        images: [],
        routing: {
          finalProvider: "bfl",
          modelAttempts: [
            { canonicalSlug: REQUESTED_MODEL, success: false },
            { canonicalSlug: "bfl/flux-kontext-max", success: true },
          ],
        },
      },
    });

    const { provenance, result } = await runWithModel(model);

    expect(result.image.base64).toBe(PIXEL);

    expect(provenance).toMatchObject({
      costUsd: 0.0082,
      model: "bfl/flux-kontext-max",
      promptVersion: getPromptVersion({ systemPrompt: TEMPLATE, version: "style-v1" }),
      provider: "bfl",
      requestedModel: REQUESTED_MODEL,
      usage: { inputTokens: 120, outputTokens: 272, totalTokens: 392 },
    });
  });

  it("falls back to the requested model when the provider reports no routing", async () => {
    const { provenance } = await runWithModel(imageModel());

    expect(provenance).toMatchObject({
      model: REQUESTED_MODEL,
      provider: "openai",
      requestedModel: REQUESTED_MODEL,
    });

    expect(provenance.costUsd).toBeUndefined();
  });
});
