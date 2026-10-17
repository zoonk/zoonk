import { preloadMathRenderer } from "#math-renderer";
import { use, useEffect } from "react";
import { collectFormulas } from "./math-formulas";
import { mathMarkupKey } from "./math-key";
import { MathMarkupContext } from "./math-markup-context";

/**
 * Starts loading KaTeX as soon as a screen's content (a lesson's steps, a run's questions) has a
 * formula the server didn't draw ahead (`MathMarkupProvider`), so a formula on a later screen
 * draws at once. Content whose formulas were all drawn never loads it.
 */
export function usePreloadMath(content: unknown) {
  const drawn = use(MathMarkupContext);

  useEffect(() => {
    const undrawn = collectFormulas(content).some(
      (formula) => drawn?.[mathMarkupKey(formula)] === undefined,
    );

    if (undrawn) {
      void preloadMathRenderer();
    }
  }, [content, drawn]);
}
