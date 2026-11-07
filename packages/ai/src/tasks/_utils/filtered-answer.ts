import { type FinishReason, type LanguageModelUsage, NoObjectGeneratedError } from "ai";

type Answer = {
  finalStep: { response: ConstructorParameters<typeof NoObjectGeneratedError>[0]["response"] };
  finishReason: FinishReason;
  text: string;
  usage: LanguageModelUsage;
};

/** Output that fails its schema after these fails again on a retry. */
const FINISHED: ReadonlySet<FinishReason | undefined> = new Set([
  "content-filter",
  "length",
  "stop",
]);

/**
 * Wraps an object answer's call. The AI SDK fails output its schema can't accept as missing an
 * object also when the provider failed partway through the answer, which a retry can fix; that one
 * is failed as an ordinary error, with no `cause`, so `AI_NoObjectGeneratedError` stays the error
 * workflows record as a failure no retry fixes.
 */
export function failUnfinishedAnswer<T>(answer: Promise<T>): Promise<T> {
  return answer.catch((error: unknown) => {
    if (NoObjectGeneratedError.isInstance(error) && !FINISHED.has(error.finishReason)) {
      throw new Error(
        `The answer ended for "${error.finishReason}" before its output was read: ${error.message}`,
      );
    }

    throw error;
  });
}

/**
 * Call before reading an object answer's output. The AI SDK reports an empty answer the provider's
 * filter stopped as missing output, as it does a failed call, so it's failed here as a refusal, the
 * error workflows record as a failure no retry fixes. Every other empty answer is left for a retry.
 */
export function failFilteredAnswer(result: Answer): void {
  if (result.finishReason === "content-filter" && !result.text) {
    throw new NoObjectGeneratedError({
      finishReason: result.finishReason,
      response: result.finalStep.response,
      text: result.text,
      usage: result.usage,
    });
  }
}
