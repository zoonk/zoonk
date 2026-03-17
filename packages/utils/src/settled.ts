import { isJsonObject } from "./json";

/**
 * Extracts a single Promise.allSettled result with a fallback for rejected promises.
 */
export function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}

/**
 * Checks if any Promise.allSettled result failed — either by rejection or by
 * resolving with a truthy `error` property (the `{ data, error }` pattern).
 */
export function rejected(results: PromiseSettledResult<unknown>[]): boolean {
  return results.some(
    (result) =>
      result.status === "rejected" ||
      (result.status === "fulfilled" && hasValueError(result.value)),
  );
}

function hasValueError(value: unknown): boolean {
  return isJsonObject(value) && "error" in value && Boolean(value.error);
}

/**
 * Extracts the fulfilled values from a Promise.allSettled array, dropping rejections.
 */
export function settledValues<T>(results: PromiseSettledResult<T>[]): T[] {
  return results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
}
