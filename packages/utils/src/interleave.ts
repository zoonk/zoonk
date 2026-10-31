export function interleave<T>(groups: readonly (readonly T[])[]): T[] {
  const rounds = Math.max(0, ...groups.map((group) => group.length));

  return Array.from({ length: rounds }, (_, round) =>
    groups.flatMap((group) => group.slice(round, round + 1)),
  ).flat();
}

function getTurnAt({ turn, weight }: { turn: number; weight: number }): number {
  if (turn === 0) {
    return 0;
  }

  return weight > 0 ? turn / weight : Number.POSITIVE_INFINITY;
}

/**
 * Every group's first element comes first, in group order; after that a group comes up in
 * proportion to its weight, and one weighing nothing only once the others run out. Equal weights
 * give `interleave`'s order.
 */
export function interleaveByWeight<T>(
  groups: readonly { items: readonly T[]; weight: number }[],
): T[] {
  return groups
    .flatMap((group, order) =>
      group.items.map((item, turn) => ({
        at: getTurnAt({ turn, weight: group.weight }),
        item,
        order,
        turn,
      })),
    )
    .toSorted((a, b) => (a.at === b.at ? 0 : a.at - b.at) || a.order - b.order || a.turn - b.turn)
    .map((entry) => entry.item);
}
