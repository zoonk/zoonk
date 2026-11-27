import { seededShuffle } from "@zoonk/utils/seeded-random";

function compareText(first: string, second: string): number {
  if (first === second) {
    return 0;
  }

  return first < second ? -1 : 1;
}

/**
 * A shuffled order that every build of the shared lesson read gives the same items, however they
 * arrive, so the sitting's order laid over it never moves when the cache is rebuilt or read from
 * another app.
 */
export function stableOrder<T>({
  items,
  key,
  text,
}: {
  items: readonly T[];
  key: string;
  text: (item: T) => string;
}): T[] {
  const sorted = items.toSorted((first, second) => compareText(text(first), text(second)));
  return seededShuffle(sorted, [key, ...sorted.map((item) => text(item))].join("\n"));
}
