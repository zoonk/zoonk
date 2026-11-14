import { preloadMathRenderer } from "#math-renderer";
import { useEffect } from "react";
import { collectFormulas } from "./math-formulas";

/**
 * Loads KaTeX for a screen with formulas, even when the server drew them: its feedback,
 * explanations and tutor answers arrive later and are drawn here.
 */
export function usePreloadMath(content: unknown) {
  useEffect(() => {
    if (collectFormulas(content).length > 0) {
      void preloadMathRenderer();
    }
  }, [content]);
}
