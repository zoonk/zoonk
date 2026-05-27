import { GatewayInternalServerError } from "@ai-sdk/gateway";
import { generateImage, generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { generateImageWithSafetyRetry } from "./generate-image-with-safety-retry";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("../images/image-prompt-safety-rewrite.prompt.md", () => ({ default: "Rewrite safely." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();

  return { ...actual, generateImage: vi.fn(), generateText: vi.fn() };
});

/**
 * Creates the smallest AI SDK image result shape this retry helper needs. The
 * retry logic only forwards the result, so the bytes can be fake while the
 * object still matches the SDK contract used by production callers.
 */
function createImageResult() {
  const image = {
    base64: "aW1hZ2U=",
    mediaType: "image/webp" as const,
    uint8Array: new Uint8Array([1, 2, 3]),
  };

  return {
    image,
    images: [image],
    providerMetadata: {},
    responses: [],
    usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
    warnings: [],
  };
}

/**
 * Recreates the Gateway safety wrapper shape from real image failures without
 * importing transitive provider internals. The helper must detect the safety
 * wording whether it appears on the top-level Gateway error or nested response
 * payload.
 */
function createSafetyRejectionError() {
  const cause = {
    isRetryable: false,
    message: "[object Object]",
    requestBodyValues: {},
    responseBody: JSON.stringify({
      error: {
        message:
          "Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com.",
        type: "AI_APICallError",
      },
    }),
    statusCode: 400,
    url: "https://ai-gateway.vercel.sh/v3/ai/image-model",
  };

  return new GatewayInternalServerError({
    cause,
    message:
      "Your request was rejected by the safety system. If you believe this is an error, contact us at help.openai.com.",
    statusCode: 400,
  });
}

describe(generateImageWithSafetyRetry, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rewrites safety-rejected image inputs before retrying generation", async () => {
    const originalInput = "Mickey Mouse";
    const rewrittenInput = "A vintage animation film reel";
    const imageResult = createImageResult();

    vi.mocked(generateImage)
      .mockRejectedValueOnce(createSafetyRejectionError())
      .mockResolvedValueOnce(imageResult);

    vi.mocked(generateText).mockResolvedValueOnce({
      output: { input: rewrittenInput },
      usage: {},
    } as Awaited<ReturnType<typeof generateText>>);

    const result = await generateImageWithSafetyRetry({
      buildPrompt: ({ input }) => `Create a course thumbnail for ${input}.`,
      input: originalInput,
      maxImagesPerCall: 1,
      model: "openai/gpt-image-2",
      size: "1024x1024",
    });

    expect(result).toBe(imageResult);
    expect(generateText).toHaveBeenCalledOnce();

    expect(generateImage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ prompt: "Create a course thumbnail for Mickey Mouse." }),
    );

    expect(generateImage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        prompt: "Create a course thumbnail for A vintage animation film reel.",
      }),
    );
  });

  it("does not rewrite image inputs for normal generation failures", async () => {
    vi.mocked(generateImage).mockRejectedValueOnce(new Error("Model timed out"));

    await expect(
      generateImageWithSafetyRetry({
        buildPrompt: ({ input }) => `Create a course thumbnail for ${input}.`,
        input: "safe course",
        maxImagesPerCall: 1,
        model: "openai/gpt-image-2",
        size: "1024x1024",
      }),
    ).rejects.toThrow("Model timed out");

    expect(generateText).not.toHaveBeenCalled();
    expect(generateImage).toHaveBeenCalledOnce();
  });
});
