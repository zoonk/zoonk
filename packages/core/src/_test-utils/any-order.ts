function sortKey(item: unknown): string {
  return typeof item === "object" && item !== null && "word" in item
    ? String(item.word)
    : JSON.stringify(item);
}

/** A list sorted by each tile's word (other values by their JSON), for checks of what a list holds rather than its order. */
export function anyOrder<T>(items: readonly T[] | undefined): T[] {
  return (items ?? []).toSorted((first, second) => sortKey(first).localeCompare(sortKey(second)));
}
