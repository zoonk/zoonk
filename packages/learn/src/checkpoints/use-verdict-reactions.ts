"use client";

import { type ActorHandle, type TricksterActName } from "@zoonk/ui/components/trickster-actor";
import { useEffect, useRef } from "react";
import { useCheckpointScreen } from "./checkpoint-context";

/**
 * The Trickster reacting to each verdict as it comes in: smug when the learner misses one, and when
 * they get one past him a blink that drops his grin, back to sly. A reload draws him sly.
 */
export function useVerdictReactions() {
  const { duel } = useCheckpointScreen();
  const trickster = useRef<ActorHandle<TricksterActName>>(null);
  const { feedback } = duel.state;

  useEffect(() => {
    if (feedback) {
      void trickster.current?.play(feedback.isCorrect ? "sly" : "smug");
    }
  }, [feedback]);

  return trickster;
}
