"use client";

import { useLayoutEffect, useState } from "react";

/**
 * Next.js keeps a page the learner leaves mounted but hidden, so a visit to Today ends when it
 * hides, not when it unmounts. What the learner did on one visit, such as a notice they answered,
 * belongs to that visit only.
 */
export function useTodayVisit(): number {
  const [visit, setVisit] = useState(0);

  useLayoutEffect(() => () => setVisit((current) => current + 1), []);

  return visit;
}
