import { type MathMarkupRenderer } from "./math-key";
import { renderMathMarkup } from "./math-markup";

/**
 * A formula's MathML on the server: drawn here, so it's in the page's HTML (and a Server
 * Component's output). The browser has its own (`math-renderer.browser.ts`), which loads KaTeX
 * only for math the server didn't draw ahead.
 */
export function useMathMarkup(formula: { displayMode: boolean; text: string }): string | null {
  return renderMathMarkup(formula);
}

/** Nothing to load on the server: KaTeX is already here. */
export function preloadMathRenderer(): Promise<MathMarkupRenderer | null> {
  return Promise.resolve(renderMathMarkup);
}
