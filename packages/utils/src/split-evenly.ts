/** The fewest chunks of at most `size`, in order, their sizes at most one apart. */
export function splitEvenly<T>({ items, size }: { items: readonly T[]; size: number }): T[][] {
  const count = Math.ceil(items.length / size);

  return Array.from({ length: count }, (_, index) =>
    items.slice(
      Math.floor((index * items.length) / count),
      Math.floor(((index + 1) * items.length) / count),
    ),
  );
}
