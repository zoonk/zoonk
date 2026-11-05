/** Vitest lacks Next's request cache: keep each read by its arguments, as one request's private cache does. */
export function keepRequestReads<Args extends (string | readonly string[])[], Result>(
  read: (...args: Args) => Promise<Result>,
): (...args: Args) => Promise<Result> {
  const reads = new Map<string, Promise<Result>>();

  return (...args) => {
    const key = args.join(":");
    const kept = reads.get(key) ?? read(...args);
    reads.set(key, kept);
    return kept;
  };
}
