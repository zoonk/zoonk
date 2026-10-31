"use client";

import { createContext, use } from "react";

export const CeremonyClosingContext = createContext<() => void>(() => {
  // Shown on its own, a ceremony has nothing under it to draw.
});

export function useCeremonyClosing(): () => void {
  return use(CeremonyClosingContext);
}
