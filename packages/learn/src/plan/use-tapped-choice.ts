"use client";

import { useState } from "react";

/** Shows the learner's tap at once while its change saves, then the saved choice; a pick never shows again over a later change. */
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
