import { isJsonObject } from "./json";

/**
 * Extracts a single Promise.allSettled result with a fallback for rejected promises.
 */
export function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * Extracts every failure carried by Promise.allSettled results. This keeps the
 * real thrown reasons for rejected promises and also supports older helpers
 * that resolve to `{ data, error }` instead of throwing.
 */
export function settledFailures(results: PromiseSettledResult<unknown>[]): Error[] {
  return results.flatMap((result) => {
    if (result.status === "rejected") {
      return [toError(result.reason)];
    }

    const error = getValueError(result.value);
    return error ? [error] : [];
  });
}

/**
 * Converts collected failures into the error shape callers should throw. A
 * single failure keeps its original identity, while multiple failures become an
 * AggregateError so final workflow logs can include every underlying problem.
 */
export function getSettledFailureError({
  failures,
  message,
}: {
  failures: Error[];
  message: string;
}): Error | null {
  if (failures.length === 0) {
    return null;
  }

  if (failures.length === 1) {
    return failures[0] ?? null;
  }

  return new AggregateError(failures, message);
}

/**
 * Throws all failures from Promise.allSettled results, preserving the original
 * error when only one operation failed and aggregating when several failed.
 */
export function throwSettledFailures({
  message,
  results,
}: {
  message: string;
  results: PromiseSettledResult<unknown>[];
}): void {
  const error = getSettledFailureError({ failures: settledFailures(results), message });

  if (error) {
    throw error;
  }
}

function getValueError(value: unknown): Error | null {
  if (!isJsonObject(value) || !("error" in value) || !value.error) {
    return null;
  }

  return toError(value.error);
}

/**
 * Normalizes unusual promise rejection values into throwable Error objects.
 * JavaScript allows rejecting with strings or plain provider objects, but our
 * callers throw these failures so the value must be an Error.
 */
function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value;
  }

  if (isJsonObject(value) && typeof value.message === "string") {
    const error = new Error(value.message, { cause: value });

    if (typeof value.name === "string") {
      error.name = value.name;
    }

    if (typeof value.stack === "string") {
      error.stack = value.stack;
    }

    return error;
  }

  return new Error(String(value), { cause: value });
}

/**
 * Extracts the fulfilled values from a Promise.allSettled array, dropping rejections.
 */
export function settledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}
