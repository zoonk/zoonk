export function keyedByPosition<TItem>(
  items: readonly TItem[],
  describe: (item: TItem) => string,
): { item: TItem; key: string }[] {
  return items.map((item, position) => ({ item, key: `${position}:${describe(item)}` }));
}
