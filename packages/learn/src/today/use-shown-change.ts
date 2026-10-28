"use client";

import { type TodayView } from "@zoonk/core/view-models/today/get";
import { useState } from "react";

type Change = NonNullable<TodayView["planChange"]>;

/** Follows Today's latest read until the learner answers here, so a proposal answered elsewhere leaves the screen; an answered one stays to show what the answer did. */
export function useShownChange(change: Change | null) {
  const [shown, setShown] = useState<{ change: Change; swapped: boolean } | null>(
    change ? { change, swapped: false } : null,
  );

  const [held, setHeld] = useState(false);

  if (shown !== null && !held && shown.change !== change) {
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
