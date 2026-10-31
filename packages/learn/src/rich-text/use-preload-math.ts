import { preloadMathRenderer } from "#math-renderer";
import { use, useEffect } from "react";
import { collectFormulas } from "./math-formulas";
import { mathMarkupKey } from "./math-key";
import { MathMarkupContext } from "./math-markup-context";

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
