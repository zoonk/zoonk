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

function failUnfinished(finishReason: FinishReason | undefined, message: string): never {
  throw new Error(`The answer ended for "${finishReason}" before its output was read: ${message}`);
}

/**
 * Wraps an object answer's call. An answer the provider failed partway through, which a retry can
 * fix, is failed as an ordinary error with no `cause`, whether the AI SDK then missed an object or
 * its output happened to pass the schema, so `AI_NoObjectGeneratedError` stays the error workflows
 * record as a failure no retry fixes.
 */
export function failUnfinishedAnswer<T extends { finishReason: FinishReason }>(
  answer: Promise<T>,
): Promise<T> {
  return answer.then(
    (result) =>
      FINISHED.has(result.finishReason)
        ? result
        : failUnfinished(result.finishReason, "the provider failed"),
    (error: unknown) => {
      if (NoObjectGeneratedError.isInstance(error) && !FINISHED.has(error.finishReason)) {
        failUnfinished(error.finishReason, error.message);
      }

      throw error;
    },
  );
}

/**
 * Call before reading an object answer's output. The AI SDK reports an empty answer the provider's
 * filter stopped, or one that used up the output limit, as missing output, as it does a failed
 * call, so it's failed here as the error workflows record as a failure no retry fixes. Every other
 * empty answer is left for a retry.
 */
export function failFilteredAnswer(result: Answer): void {
  if (
    (result.finishReason === "content-filter" || result.finishReason === "length") &&
    !result.text
  ) {
    throw new NoObjectGeneratedError({
      finishReason: result.finishReason,
      response: result.finalStep.response,
      text: result.text,
      usage: result.usage,
    });
  }
}
