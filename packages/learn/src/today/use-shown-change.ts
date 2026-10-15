"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useState } from "react";

type Change = NonNullable<TodayView["planChange"]>;

/**
 * The change shown when Today opened stays while the learner is here, so answering it shows what
 * the answer did. One that turns up later shows when none did. Today reads itself again after an
 * answer: a different proposal still waiting comes up when the learner asks (`showNext`). A notice
 * holds its change from the learner's answer (`hold`) until nothing was saved.
 */
export function useShownChange(change: Change | null) {
  const [shown, setShown] = useState<{ change: Change; swapped: boolean } | null>(
    change ? { change, swapped: false } : null,
  );

  const [held, setHeld] = useState(false);

  // One Today worked out isn't saved (no id): it's only true of the copy that says it, so until the
  // learner answers it, it follows the copy, saved meanwhile, worked out again, or gone.
  if (shown?.change.id === null && !held && shown.change !== change) {
    setShown(change ? { change, swapped: false } : null);
  }

  if (shown === null && change !== null) {
    setShown({ change, swapped: false });
  }

  const current = shown?.change ?? change;
  const next = change?.status === "proposed" && change.id !== current?.id ? change : null;

  return {
    current,
    hold: setHeld,
    showNext: next ? () => setShown({ change: next, swapped: true }) : null,
    swapped: shown?.swapped ?? false,
  };
}
