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

function toWordPattern(word: string): string {
  return word.replaceAll(
    /[$()*+./?[\\\]^{|}"'«»‘’“”]/gu,
    (char) => QUOTE_CHAR_PATTERNS[char] ?? `\\${char}`,
  );
}

/** Models often wrap quotes in quotation marks or ellipses. */
function trimQuote(quote: string): string {
  return quote.replaceAll(/^[\s"'“”‘’«».…]+|[\s"'“”‘’«».…]+$/gu, "");
}

/** A quote that isn't in the essay is dropped rather than shown. */
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
