/**
 * Where each lesson-map idea sits around the map's center, in reading order: with three or more
 * ideas the first two sit above the center, the rest below in pairs, and a last idea without a pair
 * is centered. The strip's mini map, the opening map and the end mind map all place ideas this way,
 * so an idea keeps its place from the first screen to the last.
 */
export type IdeaSlot = { column: -1 | 0 | 1; row: number };

const IDEAS_ABOVE_CENTER = 2;

function slotBelow({ count, index }: { count: number; index: number }): IdeaSlot {
  const row = 1 + Math.floor(index / 2);
  const isLastAlone = index === count - 1 && count % 2 === 1;

  if (isLastAlone) {
    return { column: 0, row };
  }

  return { column: index % 2 === 0 ? -1 : 1, row };
}

export function getIdeaSlots(count: number): IdeaSlot[] {
  const above = count > IDEAS_ABOVE_CENTER ? IDEAS_ABOVE_CENTER : 0;

  return Array.from({ length: count }, (_, index) =>
    index < above
      ? { column: index === 0 ? -1 : 1, row: -1 }
      : slotBelow({ count: count - above, index: index - above }),
  );
}

/** The rows the slots span, the center's row (0) included. */
export function getSlotRows(slots: readonly IdeaSlot[]): { first: number; last: number } {
  const rows = slots.map((slot) => slot.row);
  return { first: Math.min(0, ...rows), last: Math.max(0, ...rows) };
}
