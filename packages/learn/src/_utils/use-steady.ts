"use client";

import { useEffect, useRef } from "react";

/**
 * How long after a screen replaced another under the learner's finger a press still belongs to the
 * one before: a second Enter, or a second tap where the last answer's Continue was.
 */
export const SCREEN_STEADY_MS = 500;

/**
 * Whether a press now comes at least `ms` after the screen showed. One sooner was meant for the
 * screen before it (Enter twice, a double tap where both screens put a button), so a screen that
 * replaces another right under the learner's finger ignores it instead of acting on it.
 */
export function useSteady(ms: number): () => boolean {
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  return () => ms === 0 || (shownAt.current !== null && performance.now() - shownAt.current >= ms);
}
