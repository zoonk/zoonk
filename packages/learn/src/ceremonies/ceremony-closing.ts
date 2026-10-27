"use client";

import { createContext, use } from "react";

/**
 * How a ceremony says it has begun to close: what it crowned is drawn under it from then on, so
 * the ceremony fades out over the result rather than over an empty screen, and no frame between
 * them is blank. `MomentAfterCeremony` and `Steps` provide it around the ceremony they show.
 */
export const CeremonyClosingContext = createContext<() => void>(() => {
  // Shown on its own, a ceremony has nothing under it to draw.
});

export function useCeremonyClosing(): () => void {
  return use(CeremonyClosingContext);
}
