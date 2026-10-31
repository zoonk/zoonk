type PaletteRows = readonly { items: readonly { id: string }[] }[];

/**
 * Whether showing `next` instead of `shown` keeps every row from the top through the highlighted
 * one (`highlighted`, its index in the whole list, or -1 for none) where it is, so the rows `next`
 * adds all land below it. The palette keeps its highlight by index when its rows change, so a row
 * added at or above it would change what Enter opens.
 */
export function keepsRowsThrough({
  highlighted,
  next,
  shown,
}: {
  highlighted: number;
  next: PaletteRows;
  shown: PaletteRows;
}): boolean {
  const before = shown.flatMap((group) => group.items);
  const after = next.flatMap((group) => group.items);

  return before.slice(0, highlighted + 1).every((row, index) => after[index]?.id === row.id);
}
