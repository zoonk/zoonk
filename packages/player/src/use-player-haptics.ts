"use client";

import { useEffect, useRef } from "react";
import { useWebHaptics } from "web-haptics/react";
import { type PlayerHapticSnapshot, getPlayerHapticSequence } from "./player-haptics";

/**
 * Bridges canonical player state transitions to the haptics library.
 *
 * The player shell already owns the shared runtime snapshot, so this hook can
 * translate meaningful state changes into tactile feedback without leaking
 * haptic rules into individual step components.
 */
export function usePlayerHaptics({ current }: { current: PlayerHapticSnapshot }) {
  const { trigger } = useWebHaptics();
  const previousRef = useRef(current);

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = current;

    const sequence = getPlayerHapticSequence({
      current,
      previous,
    });

    for (const haptic of sequence) {
      void trigger(haptic);
    }
  }, [current, trigger]);
}
