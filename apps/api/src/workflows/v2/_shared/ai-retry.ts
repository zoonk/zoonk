import { isTimeoutError } from "@zoonk/ai/evaluate/timeout";
import { isJsonObject } from "@zoonk/utils/json";
import { RetryableError } from "workflow";

const TOO_MANY_REQUESTS = 429;

/** The AI SDK can wrap a provider's 429 in its own retry error. */
function isRateLimited(error: unknown): boolean {
  if (!isJsonObject(error)) {
    return false;
  }

  return error.statusCode === TOO_MANY_REQUESTS || isRateLimited(error.lastError);
}

export async function withAiRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isRateLimited(error)) {
      throw new RetryableError("The AI provider is rate limiting; retrying in a minute.", {
        retryAfter: "1m",
      });
    }

    if (isTimeoutError(error)) {
      throw new RetryableError("The AI provider is too busy to answer; retrying in a minute.", {
        retryAfter: "1m",
      });
    }

    throw error;
  }
}
