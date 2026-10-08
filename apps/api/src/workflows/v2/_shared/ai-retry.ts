import { isJsonObject } from "@zoonk/utils/json";
import { RetryableError } from "workflow";

const TOO_MANY_REQUESTS = 429;

/** Providers answer 429 when they rate limit; the AI SDK can wrap it in its own retry error. */
function isRateLimited(error: unknown): boolean {
  if (!isJsonObject(error)) {
    return false;
  }

  return error.statusCode === TOO_MANY_REQUESTS || isRateLimited(error.lastError);
}

/**
 * Runs AI work inside a step. A rate limit is retried after a minute instead of at once, so a
 * busy provider gets time to recover; every other error keeps the step's default retries.
 */
export async function withAiRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isRateLimited(error)) {
      throw new RetryableError("The AI provider is rate limiting; retrying in a minute.", {
        retryAfter: "1m",
      });
    }

    throw error;
  }
}
