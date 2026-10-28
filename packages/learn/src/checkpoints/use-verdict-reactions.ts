"use client";

import { type ActorHandle, type TricksterActName } from "@zoonk/ui/components/trickster-actor";
import { useEffect, useRef } from "react";
import { useCheckpointScreen } from "./checkpoint-context";

export function useVerdictReactions() {
  const { duel } = useCheckpointScreen();
  const trickster = useRef<ActorHandle<TricksterActName>>(null);
  const reactedTo = useRef<string | null>(null);
  const { feedback } = duel.state;

  useEffect(() => {
    if (feedback && reactedTo.current !== feedback.itemId) {
      reactedTo.current = feedback.itemId;
      void trickster.current?.play(feedback.isCorrect ? "sly" : "smug");
    }
  }, [feedback]);

  return trickster;
}
