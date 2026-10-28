"use client";

import { useEffect, useRef } from "react";

export const SCREEN_STEADY_MS = 500;

/**
 * A press sooner than `ms` after the screen showed was meant for the screen before it (Enter twice,
 * a double tap).
 */
export function useSteady(ms: number): () => boolean {
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  return () => ms === 0 || (shownAt.current !== null && performance.now() - shownAt.current >= ms);
}
