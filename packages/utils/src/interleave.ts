export function interleave<T>(groups: readonly (readonly T[])[]): T[] {
  const rounds = Math.max(0, ...groups.map((group) => group.length));

  return Array.from({ length: rounds }, (_, round) =>
    groups.flatMap((group) => group.slice(round, round + 1)),
  ).flat();
}
