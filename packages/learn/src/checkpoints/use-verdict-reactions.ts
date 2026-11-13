"use client";

import { type DuelDecision } from "@zoonk/core/checkpoints/contract";
import { type ActorHandle, type TricksterActName } from "@zoonk/ui/components/trickster-actor";
import { useEffect, useRef } from "react";
import { useCheckpointScreen } from "./checkpoint-context";
import { getDuelScore } from "./checkpoint-duel-state";

function getVerdictAct({
  decision,
  isCorrect,
}: {
  decision: DuelDecision | null;
  isCorrect: boolean;
}): TricksterActName {
  if (decision) {
    return decision === "won" ? "defeat" : "triumph";
  }

  return isCorrect ? "sly" : "smug";
}

/** He reacts to each answer, and to the one that decides the duel with its ending. */
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
