"use client";

import { useRef } from "react";

/**
 * A read's answer shows only if nothing moved the order after the read started (a later read, a
 * create's answer, a stored save): an older answer can predate those and undo them.
 */
export function useReadOrder() {
  const latest = useRef(0);

  return {
    now: () => latest.current,
    startRead: () => {
      latest.current += 1;
      const started = latest.current;
      return { isLatest: () => started === latest.current, started };
    },
    supersedeReads: () => {
      latest.current += 1;
    },
  };
}
