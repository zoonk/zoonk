const HAND = "hand:";
const ROW = "row:";

/** The card in hand and a sorted card's row drag under different ids, so a press on one never becomes a drag of the other. */
export function handDragId(itemId: string): string {
  return `${HAND}${itemId}`;
}

export function rowDragId(itemId: string): string {
  return `${ROW}${itemId}`;
}

/** The card a row drag lifted, or `null` when the drag began in the hand. */
export function rowDragItem(dragId: string): string | null {
  return dragId.startsWith(ROW) ? dragId.slice(ROW.length) : null;
}
