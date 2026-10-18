/**
 * A decision model that didn't answer before its deadline, its own retries included: a busy
 * provider, so the work is worth trying again later. The AI SDK reports a deadline that runs out
 * while it waits to retry (a rate limit, a connection that times out) as an `AbortError`, which a
 * workflow step takes for a cancellation and never retries.
 */
export class EvaluationTimeoutError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "EvaluationTimeoutError";
  }
}

/** Errors of calls that ran out of time, by name, so they're known after crossing a bundle. */
const TIMEOUT_ERROR_NAMES: ReadonlySet<string> = new Set([
  "EvaluationTimeoutError",
  "TimeoutError",
]);

/** A call that ran out of time: an evaluation past its deadline, or a request's `TimeoutError`. */
export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && TIMEOUT_ERROR_NAMES.has(error.name);
}

/**
 * The error of an AI SDK call whose only abort source is its own deadline (`timeout`, no signal
 * of the caller's): an `AbortError` there is that deadline running out while the SDK waited to
 * retry, so it's reported as the `TimeoutError` it is, which a workflow step retries instead of
 * taking it for a cancellation. Any other error passes as it is.
 */
export function toDeadlineError(error: unknown): unknown {
  if (!(error instanceof Error) || error.name !== "AbortError") {
    return error;
  }

  const timeout = new Error(`The call ran out of time: ${error.message}`, { cause: error });
  timeout.name = "TimeoutError";

  return timeout;
}
