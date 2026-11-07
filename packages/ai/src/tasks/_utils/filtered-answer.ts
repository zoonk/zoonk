import { type FinishReason, type LanguageModelUsage, NoObjectGeneratedError } from "ai";

type Answer = {
  finalStep: { response: ConstructorParameters<typeof NoObjectGeneratedError>[0]["response"] };
  finishReason: FinishReason;
  text: string;
  usage: LanguageModelUsage;
};

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
