const WRAPPING_QUOTE_PAIRS = [
  ['"', '"'],
  ["'", "'"],
  ["“", "”"],
  ["‘", "’"],
] as const;

function hasInnerQuotePair({
  closingQuote,
  innerValue,
  openingQuote,
}: {
  closingQuote: string;
  innerValue: string;
  openingQuote: string;
}) {
  if (openingQuote === closingQuote) {
    return innerValue.includes(openingQuote);
  }

  return innerValue.includes(openingQuote) || innerValue.includes(closingQuote);
}

/**
 * AI-authored copy sometimes arrives wrapped in one unnecessary outer quote
 * pair. Strip only that wrapper so scenario and dialogue text render as plain
 * app copy, while leaving inner quoted phrases untouched.
 */
export function stripWrappingQuotes(value: string): string {
  const trimmedValue = value.trim();

  const matchingPair = WRAPPING_QUOTE_PAIRS.find(
    ([openingQuote, closingQuote]) =>
      trimmedValue.length >= openingQuote.length + closingQuote.length &&
      trimmedValue.startsWith(openingQuote) &&
      trimmedValue.endsWith(closingQuote),
  );

  if (!matchingPair) {
    return value;
  }

  const [openingQuote, closingQuote] = matchingPair;

  const innerValue = trimmedValue.slice(
    openingQuote.length,
    trimmedValue.length - closingQuote.length,
  );

  if (hasInnerQuotePair({ closingQuote, innerValue, openingQuote })) {
    return value;
  }

  return innerValue.trim();
}
