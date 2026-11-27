/**
 * Puts each kept row back after the row that was above it, so a row that vanished elsewhere in the
 * list doesn't shift it; with nothing above it still listed, it goes first.
 */
export function keepRows<Row>({
  isKept,
  keyOf,
  next,
  previous,
}: {
  isKept: (row: Row) => boolean;
  keyOf: (row: Row) => string;
  next: readonly Row[];
  previous: readonly Row[];
}): Row[] {
  const listed = new Set(next.map((row) => keyOf(row)));
  const merged = [...next];

  const gone = [...previous.entries()].filter(([, row]) => !listed.has(keyOf(row)) && isKept(row));

  for (const [index, row] of gone) {
    const shown = new Set(merged.map((other) => keyOf(other)));
    const above = previous.slice(0, index).findLast((other) => shown.has(keyOf(other)));
    const at = above ? merged.findIndex((other) => keyOf(other) === keyOf(above)) + 1 : 0;

    merged.splice(at, 0, row);
  }

  return merged;
}

/**
 * What a list of saves shows: each row kept on this visit, and each row the server lists that's
 * still saved. A row kept on an earlier visit goes, and so does one an older copy of the list still
 * has after the learner removed it.
 */
export function shownRows<Row>({
  isKept,
  isSaved,
  keyOf,
  rows,
  served,
}: {
  isKept: (row: Row) => boolean;
  isSaved: (row: Row) => boolean;
  keyOf: (row: Row) => string;
  rows: readonly Row[];
  served: readonly Row[];
}): Row[] {
  const listed = new Set(served.map((row) => keyOf(row)));
  return rows.filter((row) => isKept(row) || (listed.has(keyOf(row)) && isSaved(row)));
}
