/** A formula as a screen draws it: its LaTeX, exactly as written, inline or on its own line. */
export type Formula = { displayMode: boolean; text: string };

/**
 * How a formula is looked up among those drawn on the server (`collectMathMarkup`): by its exact
 * source, since KaTeX keeps it in the markup (and `\verb` keeps its spaces).
 */
export function mathMarkupKey({ displayMode, text }: Formula) {
  return `${displayMode ? "display" : "inline"}:${text}`;
}

/** Formulas drawn on the server, by `mathMarkupKey`. */
export type MathMarkup = Readonly<Record<string, string>>;

/** Draws one formula as MathML (`renderMathMarkup`). */
export type MathMarkupRenderer = (formula: Formula) => string;
