"use client";

import { useState } from "react";
import { keepRows } from "./_utils/keep-rows";

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
    setShown(keepRows({ isKept, keyOf, next: rows, previous: shown }));
  }

  return shown;
}
