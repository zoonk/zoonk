const OPTIONAL_AUDIO_GENERATION_INCOMPLETE = "optionalAudioGenerationIncomplete";

/**
 * Turns a partially successful audio batch into a retryable step failure only
 * after every parallel task has settled. Rejected tasks represent persistence
 * or infrastructure failures and keep their original error so the workflow
 * cannot mistake them for an optional missing audio clip.
 */
export function requireCompleteOptionalAudioBatch<T>({
  results,
  texts,
}: {
  results: PromiseSettledResult<T | null>[];
  texts: string[];
}): void {
  const rejectedResult = results.find(
    (result): result is PromiseRejectedResult => result.status === "rejected",
  );

  if (rejectedResult) {
    throw rejectedResult.reason;
  }

  const missingTexts = results.flatMap((result, index) =>
    result.status === "fulfilled" && result.value === null ? [texts[index]] : [],
  );

  if (missingTexts.length > 0) {
    throw new Error(`${OPTIONAL_AUDIO_GENERATION_INCOMPLETE}:${missingTexts.join(", ")}`);
  }
}

/**
 * Extracts the permanent optional-audio failure description after the error
 * crosses the workflow serialization boundary. Returning the message gives the
 * reporting step the missing text without relying on a custom Error subclass.
 */
export function getOptionalAudioGenerationError(error: unknown): string | null {
  if (
    typeof error !== "object" ||
    error === null ||
    !("message" in error) ||
    typeof error.message !== "string"
  ) {
    return null;
  }

  return error.message.startsWith(`${OPTIONAL_AUDIO_GENERATION_INCOMPLETE}:`)
    ? error.message
    : null;
}
