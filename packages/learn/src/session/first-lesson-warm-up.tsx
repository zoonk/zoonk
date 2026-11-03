"use client";

import { type WarmUpDeck } from "@zoonk/core/library/warm-ups/contract";
import { useState } from "react";
import { useReadyHold } from "../warm-up/use-ready-hold";
import { WarmUpCard } from "../warm-up/warm-up-card";

/**
 * The page reads the goal's first lesson's deck only while it waits, so the card keeps it: a learner
 * who guessed finishes the card after the lesson is written, as on every wait.
 */
export function FirstLessonWarmUp({
  alternative,
  deck,
  isReady,
}: {
  alternative: boolean;
  deck: WarmUpDeck | null;
  isReady: boolean;
}) {
  const [kept, setKept] = useState(deck);
  const hold = useReadyHold(isReady);

  if (deck && deck.id !== kept?.id) {
    setKept(deck);
  }

  if (!kept || hold.status === "go") {
    return null;
  }

  return (
    <WarmUpCard
      deck={kept}
      holding={hold.status === "hold"}
      nextOnEnter={!alternative}
      onGuess={hold.onGuess}
      surface="lessonWait"
    />
  );
}
