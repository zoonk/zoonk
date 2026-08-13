/**
 * Keeps the first generated item for each caller-defined identity. AI output can
 * repeat an item with conflicting metadata, and the first complete item is the
 * simplest deterministic choice for lesson length and persistence.
 */
export function deduplicateGeneratedItems<Item>({
  getKey,
  items,
}: {
  getKey: (item: Item) => string;
  items: Item[];
}): Item[] {
  const seenKeys = new Set<string>();
  const uniqueItems: Item[] = [];

  for (const item of items) {
    const key = getKey(item);

    if (!seenKeys.has(key)) {
      seenKeys.add(key);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}
