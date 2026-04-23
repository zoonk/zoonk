const WRAPPING_QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
] as const;

/**
 * AI-authored copy sometimes arrives wrapped in one unnecessary outer quote
 * pair. Strip only that wrapper so scenario and dialogue text render as plain
 * app copy, while leaving inner quoted phrases untouched.
 */
export function stripWrappingQuotes(value: string): string {
  const trimmedValue = value.trim();
  const matchingPair = WRAPPING_QUOTE_PAIRS.find(
    ([openingQuote, closingQuote]) =>
      trimmedValue.startsWith(openingQuote) && trimmedValue.endsWith(closingQuote),
  );

  if (!matchingPair) {
    return value;
  }

  const [openingQuote, closingQuote] = matchingPair;
  return trimmedValue.slice(openingQuote.length, trimmedValue.length - closingQuote.length).trim();
}
