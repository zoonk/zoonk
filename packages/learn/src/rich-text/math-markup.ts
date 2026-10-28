import { renderToString } from "katex";
import { collectFormulas } from "./math-formulas";
import { type MathMarkup, type MathMarkupRenderer, mathMarkupKey } from "./math-key";

/**
 * Structured AI responses can over-escape LaTeX commands (`\\rightarrow`), which KaTeX reads as
 * text.
 */
function normalizeLatexCommands(text: string) {
  return text.replaceAll(/\\\\[A-Za-z]+/gu, (escapedCommand) => escapedCommand.slice(1));
}

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
