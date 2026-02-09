/**
 * Extracts a single Promise.allSettled result with a fallback for rejected promises.
 */
export function settled<T>(result: PromiseSettledResult<T>, fallback: T): T {
  return result.status === "fulfilled" ? result.value : fallback;
}
