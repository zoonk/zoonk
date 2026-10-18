/**
 * React keys for items that can repeat and never move, like a query's result rows or a line's
 * tokens: the position makes each key unique, the text keeps it readable in dev tools.
 */
export function keyedByPosition<TItem>(
  items: readonly TItem[],
  describe: (item: TItem) => string,
): { item: TItem; key: string }[] {
  return items.map((item, position) => ({ item, key: `${position}:${describe(item)}` }));
}
