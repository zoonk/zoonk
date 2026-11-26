"use client";

import { useState } from "react";

/** Puts each kept row back where it was, after the rows still listed before it. */
function keep<Row>({
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

  for (const [index, row] of previous.entries()) {
    if (!listed.has(keyOf(row)) && isKept(row)) {
      merged.splice(Math.min(index, merged.length), 0, row);
    }
  }

  return merged;
}

/**
 * A list of saves keeps the rows the learner removed on this page, where they were, until they
 * leave: nothing moves under their thumb, and a tap saves it again. A newer copy of the list from
 * the server drops only the rows removed somewhere else.
 */
export function useKeptRows<Row>({
  isKept,
  keyOf,
  rows,
}: {
  isKept: (row: Row) => boolean;
  keyOf: (row: Row) => string;
  rows: readonly Row[];
}): readonly Row[] {
  const [served, setServed] = useState(rows);
  const [shown, setShown] = useState(rows);

  if (served !== rows) {
    setServed(rows);
    setShown(keep({ isKept, keyOf, next: rows, previous: shown }));
  }

  return shown;
}
