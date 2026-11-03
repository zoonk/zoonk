"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { useState } from "react";
import { type ReadyHoldControl, useReadyHold } from "../warm-up/use-ready-hold";

/**
 * The page reads the goal's first lesson's deck only while it waits, so the card keeps it: a learner
 * who guessed finishes the card after the lesson is written, as on every wait. Null once it goes.
 */
export function useFirstLessonWarmUp({
  deck,
  isReady,
}: {
  deck: WarmUpDeck | null;
  isReady: boolean;
}): { deck: WarmUpDeck; hold: ReadyHoldControl } | null {
  const [kept, setKept] = useState(deck);
  const hold = useReadyHold(isReady);

  if (deck && deck.id !== kept?.id) {
    setKept(deck);
  }

  return kept && hold.status !== "go" ? { deck: kept, hold } : null;
}
