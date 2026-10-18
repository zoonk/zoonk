"use client";

import { createContext } from "react";
import { type MathMarkup } from "./math-key";

export const MathMarkupContext = createContext<MathMarkup | null>(null);

/**
 * The formulas of a screen's content, drawn on the server (`collectMathMarkup`), so the browser
 * shows them without loading KaTeX: a lesson's every screen, not only the first one in the HTML.
 */
export function MathMarkupProvider({
  children,
  markup,
}: {
  children: React.ReactNode;
  markup: MathMarkup;
}) {
  return <MathMarkupContext value={markup}>{children}</MathMarkupContext>;
}
