import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { RetryableError } from "workflow";
import { withAiRetry } from "./ai-retry";

function providerError(statusCode: number) {
  return new APICallError({
    message: `The provider answered ${statusCode}`,
    requestBodyValues: {},
    statusCode,
    url: "https://ai-gateway.test/v1/chat/completions",
  });
}

describe(withAiRetry, () => {
  it.each([
    ["the provider's rate limit", providerError(429)],
    [
      "a rate limit the AI SDK's own retries gave up on",
      new RetryError({
        errors: [providerError(500), providerError(429)],
        message: "Failed after 2 attempts",
        reason: "maxRetriesExceeded",
      }),
    ],
  ])("retries the step after a minute on %s", async (_name, rateLimit) => {
    const thrown = await withAiRetry(() => Promise.reject(rateLimit)).catch(
      (error: unknown) => error,
    );

    expect(thrown).toBeInstanceOf(RetryableError);
    expect(thrown).toMatchObject({ retryAfter: "1m" });
  });

  it("leaves every other failure to the step's default retries, and passes answers through", async () => {
    const serverError = providerError(500);
    const invalidOutput = new Error("The model's output didn't match the schema");

    await expect(withAiRetry(() => Promise.reject(serverError))).rejects.toBe(serverError);
    await expect(withAiRetry(() => Promise.reject(invalidOutput))).rejects.toBe(invalidOutput);
    await expect(withAiRetry(() => Promise.resolve("answer"))).resolves.toBe("answer");
  });
});
