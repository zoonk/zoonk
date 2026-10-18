"use client";

import { useState } from "react";

/**
 * What a plan control shows: the learner's tap at once while its change saves, since re-planning
 * can take a few seconds, and the saved choice otherwise. `pick` holds the tapped value and
 * returns its change's answer (see `usePlanChange`), which lets the pick go with the re-planned
 * page: a change that didn't work shows the saved choice again by "That didn't work", and a pick
 * never shows again over a later change, such as an undo or another control's change.
 */
export function useTappedChoice<T>(saved: T) {
  const [tapped, setTapped] = useState<{ value: T } | null>(null);

  const pick = (value: T) => {
    const next = { value };
    setTapped(next);

    // Only this pick goes: a later one stays until its own change answers.
    return () => setTapped((current) => (current === next ? null : current));
  };

  return { pick, shown: tapped ? tapped.value : saved };
}
