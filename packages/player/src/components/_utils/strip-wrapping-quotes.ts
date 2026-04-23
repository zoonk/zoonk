const QUOTE_PAIRS: Record<string, string> = {
  '"': '"',
  "'": "'",
  "‘": "’",
  "“": "”",
};

/**
 * Matches any quote character that has at least one non-word neighbor (or sits
 * at a string edge). This is how we detect an intentional inner quote while
 * ignoring apostrophes inside words like "it's", where both neighbors are
 * letters.
 */
const NESTED_QUOTE_PATTERN = /(?<![\p{L}\p{N}])['"‘’“”]|['"‘’“”](?![\p{L}\p{N}])/u;

/**
 * AI-authored copy sometimes arrives wrapped in one unnecessary outer quote
 * pair. Strip only that wrapper so scenario and dialogue text render as plain
 * app copy, while leaving inner quoted phrases untouched.
 */
export function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  const opener = trimmed[0];
  const closer = opener && QUOTE_PAIRS[opener];

  if (!closer || trimmed.length < 2 || !trimmed.endsWith(closer)) {
    return value;
  }

  const inner = trimmed.slice(1, -1);
  return NESTED_QUOTE_PATTERN.test(inner) ? value : inner.trim();
}
