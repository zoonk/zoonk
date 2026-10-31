export type Formula = { displayMode: boolean; text: string };

/** By the formula's exact source, as KaTeX keeps it in the markup (`\verb` keeps its spaces). */
export function mathMarkupKey({ displayMode, text }: Formula) {
  return `${displayMode ? "display" : "inline"}:${text}`;
}

export type MathMarkup = Readonly<Record<string, string>>;

export type MathMarkupRenderer = (formula: Formula) => string;
