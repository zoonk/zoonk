/** A `$` after a capital is a currency sign ("R$ 30"), which the rich text leaves as text. */
const MARKUP = /[*`|\n]|(?<!\p{Lu})\$/u;
const SENTENCE_END = /[.!?…:;]["'”’»)\]」』]*$/u;
const CJK_SENTENCE_END = /[。！？]$/u;
/** After a CJK quotation's own 。 the sentence goes on (「ありがとう。」と言った), so only a bare 。 ends one. */
const CJK_SENTENCE_BREAK = /[。！？]\s*$/u;
const SENTENCE_BREAK = /[.!?…:;]["'”’»)\]」』]*\s+$/u;
const LINE_BREAK = /\n\s*$/u;
/** In cased scripts a sentence never starts lowercase: "She said “Hello.” and left." */
const LOWERCASE_START = /^\p{Ll}/u;
const BOLD = "**";

/**
 * Plain words the rendered text shows together: the text's own characters once its bold marks are
 * removed, so an underline may start, end or run through a bold term.
 */
export function isUnderlineQuote({ quote, text }: { quote: string; text: string }): boolean {
  return (
    quote.length > 0 &&
    quote.trim() === quote &&
    !MARKUP.test(quote) &&
    text.replaceAll(BOLD, "").includes(quote)
  );
}

function countBold(text: string): number {
  return text.split(BOLD).length - 1;
}

function startsSentence({ before, quote }: { before: string; quote: string }): boolean {
  if (before.trim() === "") {
    return true;
  }

  return (
    !LOWERCASE_START.test(quote) &&
    (SENTENCE_BREAK.test(before) || CJK_SENTENCE_BREAK.test(before) || LINE_BREAK.test(before))
  );
}

function endsSentence({ after, quote }: { after: string; quote: string }): boolean {
  const next = after.trimStart();

  if (next === "") {
    return true;
  }

  return (
    !LOWERCASE_START.test(next) &&
    ((SENTENCE_END.test(quote) && /^\s/u.test(after)) || CJK_SENTENCE_END.test(quote))
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
    startsSentence({ before: text.slice(0, start), quote }) &&
    endsSentence({ after, quote })
  );
}
