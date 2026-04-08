"use client";

import { type Verdict, useVerdictText } from "./verdict-label";

/**
 * Screen-reader announcement for answer feedback.
 *
 * Reuses the same verdict text as VerdictLabel so visual
 * and auditory feedback are consistent.
 */
export function ResultAnnouncement({ verdict }: { verdict: Verdict }) {
  const text = useVerdictText(verdict);

  return (
    <div aria-live="polite" className="sr-only" role="status">
      {text}
    </div>
  );
}
