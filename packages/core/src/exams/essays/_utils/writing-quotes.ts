const QUOTE_PUNCTUATION = new Map(
  ["'‘’‚‛", '"“”„‟', "-‐‑‒–—―﹘﹣－"].flatMap((group) =>
    Array.from(group, (part) => [part, group.slice(0, 1)] as const),
  ),
);

function comparableQuotePart(part: string): string {
  if (/^\p{White_Space}/u.test(part)) {
    return " ";
  }

  return QUOTE_PUNCTUATION.get(part) ?? part.toLowerCase();
}

function comparableQuote(text: string) {
  const offsets = [0];

  const value = Array.from(text.matchAll(/\p{White_Space}+|./gsu), ({ 0: part, index }) => {
    const comparable = comparableQuotePart(part);
    offsets[offsets.length + comparable.length - 1] = index + part.length;
    return comparable;
  }).join("");

  return { offsets, value };
}

type QuoteSpan = { end: number; start: number };

/**
 * A quote is evidence wherever it occurs; only one that occurs once can be highlighted. Offsets
 * refer to the original UTF-16 text.
 */
export function createWritingQuoteLookup(text: string) {
  const { offsets, value } = comparableQuote(text);

  function findAll(quote: string | null): QuoteSpan[] {
    if (!quote || !/\P{White_Space}/u.test(quote.trim())) {
      return [];
    }

    const candidate = comparableQuote(quote).value;
    const matches: QuoteSpan[] = [];

    for (
      let index = value.indexOf(candidate);
      index !== -1;
      index = value.indexOf(candidate, index + 1)
    ) {
      const start = offsets[index];
      const end = offsets[index + candidate.length];

      if (start !== undefined && end !== undefined) {
        matches.push({ end, start });
      }
    }

    return matches;
  }

  return {
    locate: (quote: string | null): QuoteSpan | null => findAll(quote)[0] ?? null,
    locateUnique(quote: string | null): QuoteSpan | null {
      const [match, ...others] = findAll(quote);
      return match && others.length === 0 ? match : null;
    },
  };
}

export type WritingQuoteLookup = ReturnType<typeof createWritingQuoteLookup>;
