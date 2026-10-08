/** Shorter quotes match anywhere and highlight nothing useful. */
const MIN_QUOTE_LENGTH = 3;

const QUOTE_CHAR_PATTERNS: Record<string, string> = {
  '"': `["“”«»]`,
  "'": `['‘’]`,
  "«": `["“”«»]`,
  "»": `["“”«»]`,
  "‘": `['‘’]`,
  "’": `['‘’]`,
  "“": `["“”«»]`,
  "”": `["“”«»]`,
};

/** Escapes regex syntax and lets any quotation mark style match any other. */
function toWordPattern(word: string): string {
  return word.replaceAll(
    /[$()*+./?[\\\]^{|}"'«»‘’“”]/gu,
    (char) => QUOTE_CHAR_PATTERNS[char] ?? `\\${char}`,
  );
}

/**
 * Models often wrap quotes in quotation marks or ellipses. Dropping edge
 * punctuation still leaves a passage that is in the essay.
 */
function trimQuote(quote: string): string {
  return quote.replaceAll(/^[\s"'“”‘’«».…]+|[\s"'“”‘’«».…]+$/gu, "");
}

/**
 * Finds the model's quote in the essay ignoring case, spacing and the style
 * of quotation marks, and returns the essay's own text so the app can
 * highlight it. A quote that isn't in the essay is dropped rather than shown.
 */
export function findEssayQuote({ essay, quote }: { essay: string; quote: string | null }) {
  const words = trimQuote(quote ?? "")
    .split(/\s+/u)
    .filter(Boolean);

  if (words.join(" ").length < MIN_QUOTE_LENGTH) {
    return null;
  }

  const pattern = new RegExp(words.map((word) => toWordPattern(word)).join(String.raw`\s+`), "iu");
  return pattern.exec(essay)?.[0] ?? null;
}
