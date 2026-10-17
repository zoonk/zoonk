import { renderToString } from "katex";
import { collectFormulas } from "./math-formulas";
import { type MathMarkup, type MathMarkupRenderer, mathMarkupKey } from "./math-key";

/**
 * Some structured AI responses include JSON-escaped LaTeX commands as literal
 * learner text, such as `\\rightarrow`. KaTeX expects `\rightarrow`, so the
 * player accepts that common over-escaped shape at render time.
 */
function normalizeLatexCommands(text: string) {
  return text.replaceAll(/\\\\[A-Za-z]+/gu, (escapedCommand) => escapedCommand.slice(1));
}

/**
 * Renders LaTeX through KaTeX with errors kept inline. AI-generated formulas
 * should never crash the player, and visible fallback text makes bad formulas
 * reviewable instead of invisible.
 */
export const renderMathMarkup: MathMarkupRenderer = ({ displayMode, text }) =>
  renderToString(normalizeLatexCommands(text), {
    displayMode,
    output: "mathml",
    throwOnError: false,
    trust: false,
  });

/**
 * Draws the formulas of a screen's content (a lesson) on the server, for `MathMarkupProvider`: the
 * browser shows them without downloading KaTeX. Anything it misses is drawn in the browser.
 */
export function collectMathMarkup(content: unknown): MathMarkup {
  return Object.fromEntries(
    collectFormulas(content).map((formula) => [mathMarkupKey(formula), renderMathMarkup(formula)]),
  );
}
