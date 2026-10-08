"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void): () => void {
  const media = globalThis.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * Whether the device asks for less motion. For animations CSS can't express (a simulation
 * filling in over time); everything else uses `motion-safe:` classes.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => globalThis.matchMedia(QUERY).matches,
    () => false,
  );
}
