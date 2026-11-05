const MARKUP = /[*$`|\n]/u;
const SENTENCE_END = /[.!?…:;。！？]["'”’»)\]」』]*$/u;
const SENTENCE_START_AFTER = /(?:[.!?…:;]["'”’»)\]」』]*\s+|[。！？」』]\s*|\n\s*)$/u;
const CLOSES_WITHOUT_SPACE = /[。！？」』]$/u;
const BOLD = "**";

/** Plain words the rendered text shows as they are, so a quote inside a bold run still matches. */
export function isUnderlineQuote({ quote, text }: { quote: string; text: string }): boolean {
  return quote.length > 0 && quote.trim() === quote && !MARKUP.test(quote) && text.includes(quote);
}

function countBold(text: string): number {
  return text.split(BOLD).length - 1;
}

function startsSentence(before: string): boolean {
  return before.trim() === "" || SENTENCE_START_AFTER.test(before);
}

function endsSentence({ after, quote }: { after: string; quote: string }): boolean {
  return (
    after.trim() === "" ||
    (SENTENCE_END.test(quote) && (/^\s/u.test(after) || CLOSES_WITHOUT_SPACE.test(quote)))
  );
}

/**
 * Whole sentences of the text, markup included and balanced, so splitting the text around the
 * quote never cuts a bold run in half.
 */
export function isExampleQuote({ quote, text }: { quote: string; text: string }): boolean {
  const start = text.indexOf(quote);

  if (quote.length === 0 || quote.trim() !== quote || start === -1) {
    return false;
  }

  const after = text.slice(start + quote.length);

  return (
    countBold(quote) % 2 === 0 &&
    startsSentence(text.slice(0, start)) &&
    endsSentence({ after, quote })
  );
}
