"use client";

import { type ActorHandle, type TricksterActName } from "@zoonk/ui/components/trickster-actor";
import { useEffect, useRef } from "react";
import { useCheckpointScreen } from "./checkpoint-context";
import { getDuelScore } from "./checkpoint-duel-state";
import { getVerdictAct } from "./duel-ending";

export function useVerdictReactions() {
  const { checkpoint, duel } = useCheckpointScreen();
  const trickster = useRef<ActorHandle<TricksterActName>>(null);
  const reactedTo = useRef<string | null>(null);
  const { feedback } = duel.state;
  const { decision } = getDuelScore({ checkpoint, state: duel.state });

  useEffect(() => {
    if (feedback && reactedTo.current !== feedback.itemId) {
      reactedTo.current = feedback.itemId;
      void trickster.current?.play(getVerdictAct({ decision, isCorrect: feedback.isCorrect }));
    }
  }, [decision, feedback]);

  return trickster;
}
