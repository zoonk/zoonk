/**
 * Takes one element from each group in turn (the first of every group, then the second, and so
 * on), so a list mixes its groups instead of running through one before the next.
 */
export function interleave<T>(groups: readonly (readonly T[])[]): T[] {
  const rounds = Math.max(0, ...groups.map((group) => group.length));

  return Array.from({ length: rounds }, (_, round) =>
    groups.flatMap((group) => group.slice(round, round + 1)),
  ).flat();
}
