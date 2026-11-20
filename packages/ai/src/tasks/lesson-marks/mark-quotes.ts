import { findCodeFences, removeCodeFences } from "@zoonk/utils/code-fence";

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
    removeCodeFences(text).replaceAll(BOLD, "").includes(quote)
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

/** A code block ends where its closing fence does, and the next line starts a new block. */
function endsWithCodeBlock(text: string): boolean {
  const lines = text.split("\n");
  const block = findCodeFences(lines).at(-1);

  return block?.closed === true && block.end === lines.length;
}

function endsSentence({ after, quote }: { after: string; quote: string }): boolean {
  const next = after.trimStart();

  if (next === "") {
    return true;
  }

  return (
    !LOWERCASE_START.test(next) &&
    ((SENTENCE_END.test(quote) && /^\s/u.test(after)) ||
      CJK_SENTENCE_END.test(quote) ||
      (endsWithCodeBlock(quote) && after.startsWith("\n")))
  );
}

/** Where each code block starts and ends in the text, counted in characters. */
function findCodeSpans(text: string): { end: number; start: number }[] {
  const lines = text.split("\n");

  const starts = lines.reduce<number[]>(
    (offsets, line, index) => [...offsets, (offsets[index] ?? 0) + line.length + 1],
    [0],
  );

  return findCodeFences(lines).map(({ end, start }) => ({
    end: (starts[end] ?? text.length + 1) - 1,
    start: starts[start] ?? 0,
  }));
}

/** The example box splits the text around the quote, so it takes a code block whole or not at all. */
function keepsCodeWhole({
  end,
  start,
  text,
}: {
  end: number;
  start: number;
  text: string;
}): boolean {
  return findCodeSpans(text).every(
    (code) => end <= code.start || start >= code.end || (start <= code.start && end >= code.end),
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
    countBold(removeCodeFences(quote)) % 2 === 0 &&
    keepsCodeWhole({ end: start + quote.length, start, text }) &&
    startsSentence({ before: text.slice(0, start), quote }) &&
    endsSentence({ after, quote })
  );
}
