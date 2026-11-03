import { renderToString } from "katex";
import { normalizeLatexCommands } from "./latex-source";
import { collectFormulas } from "./math-formulas";
import { type MathMarkup, type MathMarkupRenderer, mathMarkupKey } from "./math-key";

/**
 * Errors stay inline: an AI-written formula never crashes the player, and a bad one stays visible
 * to review.
 */
export const renderMathMarkup: MathMarkupRenderer = ({ displayMode, text }) =>
  renderToString(normalizeLatexCommands(text), {
    displayMode,
    output: "mathml",
    throwOnError: false,
    trust: false,
  });

export function collectMathMarkup(content: unknown): MathMarkup {
  return Object.fromEntries(
    collectFormulas(content).map((formula) => [mathMarkupKey(formula), renderMathMarkup(formula)]),
  );
}
