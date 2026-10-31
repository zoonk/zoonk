import { type MathMarkupRenderer } from "./math-key";
import { renderMathMarkup } from "./math-markup";

export function useMathMarkup(formula: { displayMode: boolean; text: string }): string | null {
  return renderMathMarkup(formula);
}

export function preloadMathRenderer(): Promise<MathMarkupRenderer | null> {
  return Promise.resolve(renderMathMarkup);
}
