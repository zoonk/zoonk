"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Next.js keeps a page the learner leaves mounted but hidden, so a visit ends when it hides, not
 * when it unmounts. What the learner did on one visit, such as a notice they answered or a save
 * they removed, belongs to that visit only. `isCurrent` answers for work that outlives a render,
 * such as a request the learner may have left before it ended.
 */
export function usePageVisit(): { isCurrent: (visit: number) => boolean; visit: number } {
  const [visit, setVisit] = useState(0);
  const ended = useRef(0);

  useLayoutEffect(
    () => () => {
      ended.current += 1;
      setVisit((current) => current + 1);
    },
    [],
  );

  return { isCurrent: (asked) => asked === ended.current, visit };
}
