const QUOTE_PAIRS: Record<string, string> = { '"': '"', "'": "'", "‘": "’", "“": "”" };

const NESTED_QUOTE_PATTERN = /(?<![\p{L}\p{N}])['"‘’“”]|['"‘’“”](?![\p{L}\p{N}])/u;

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
