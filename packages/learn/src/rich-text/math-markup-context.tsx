"use client";

import { createContext } from "react";
import { type MathMarkup } from "./math-key";

export const MathMarkupContext = createContext<MathMarkup | null>(null);

export function MathMarkupProvider({
  children,
  markup,
}: {
  children: React.ReactNode;
  markup: MathMarkup;
}) {
  return <MathMarkupContext value={markup}>{children}</MathMarkupContext>;
}
