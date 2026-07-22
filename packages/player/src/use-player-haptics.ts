"use client";

import { useEffect, useEffectEvent, useRef } from "react";
import { type HapticInput } from "web-haptics";
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

  const triggerHaptic = useEffectEvent((haptic: HapticInput) => {
    void trigger(haptic);
  });

  useEffect(() => {
    const previous = previousRef.current;
    previousRef.current = current;

    const sequence = getPlayerHapticSequence({ current, previous });

    for (const haptic of sequence) {
      triggerHaptic(haptic);
    }
  }, [current]);
}
