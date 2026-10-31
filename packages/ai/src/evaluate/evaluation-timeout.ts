/**
 * The AI SDK reports a deadline that runs out while it waits to retry as an `AbortError`, which a
 * workflow step takes for a cancellation and never retries.
 */
export class EvaluationTimeoutError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EvaluationTimeoutError";
  }
}

/** By name, so they're known after crossing a bundle. */
const TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set([
  "EvaluationTimeoutError",
  "TimeoutError",
]);

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && TIMEOUT_ERROR_NAMES.has(error.name);
}

/**
 * For a call whose only abort source is its own deadline, an `AbortError` is that deadline running
 * out while the SDK waited to retry, so it's reported as the `TimeoutError` it is.
 */
export function toDeadlineError(error: unknown): unknown {
  if (!(error instanceof Error) || error.name !== "AbortError") {
    return error;
  }

  const timeout = new Error(`The call ran out of time: ${error.message}`, { cause: error });
  timeout.name = "TimeoutError";

  return timeout;
}
