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
/** A numbered item's marker ("2. ") ends in a period, but the item's sentence starts after it. */
const LIST_MARKER = /(?:^|\n)[^\S\n]*\d{1,3}[.)][^\S\n]+$/u;
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
    !LIST_MARKER.test(before) &&
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

/** Where each code block starts and ends in the text, from its opening fence to its closing one. */
function findCodeSpans(text: string): { end: number; start: number }[] {
  const lines = text.split("\n");

  const starts = [0];

  for (const line of lines) {
    starts.push((starts.at(-1) ?? 0) + line.length + 1);
  }

  return findCodeFences(lines).map(({ end, start }) => {
    const fence = lines[start] ?? "";

    return {
      end: (starts[end] ?? text.length + 1) - 1,
      start: (starts[start] ?? 0) + fence.length - fence.trimStart().length,
    };
  });
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

/** A quote of a numbered item's words, widened to its marker ("2. ") so the item keeps its number. */
function withListMarker({ quote, text }: { quote: string; text: string }): string {
  const start = text.indexOf(quote);
  const marker = start === -1 ? null : LIST_MARKER.exec(text.slice(0, start));
  return marker ? `${marker[0].trimStart()}${quote}` : quote;
}

const REGEXP_SYNTAX = /[\\^$.*+?()[\]{}|]/gu;
const INLINE_MARKS = /[`*]/gu;
const WHITESPACE = /^\s+$/u;
const INTRODUCES = /[:：]$/u;

type Span = { end: number; start: number };

/**
 * Where a copy of the text sits in it. Models copying across lines and markup often drop a blank
 * line, inline code's backticks or a bold run's stars, so those may differ.
 */
function locateCopy({ quote, text }: { quote: string; text: string }): Span | null {
  const exact = text.indexOf(quote);

  if (exact !== -1) {
    return { end: exact + quote.length, start: exact };
  }

  const tokens =
    quote
      .replaceAll(INLINE_MARKS, "")
      .trim()
      .match(/\s+|\S/gu) ?? [];

  const pattern = tokens
    .map((token) =>
      WHITESPACE.test(token) ? "[\\s`*]+" : token.replaceAll(REGEXP_SYNTAX, String.raw`\$&`),
    )
    .join("[`*]*");

  const found = tokens.length > 0 ? new RegExp(`[\`*]*${pattern}[\`*]*`, "u").exec(text) : null;

  return found ? { end: found.index + found[0].length, start: found.index } : null;
}

/** A model sometimes copies a block ahead of the sentence that introduces it; the text's order stands. */
function locateReordered({ quote, text }: { quote: string; text: string }): Span | null {
  const cuts = [0, ...findCodeSpans(quote).flatMap(({ end, start }) => [start, end]), quote.length];

  const parts = cuts
    .slice(1)
    .map((end, index) => quote.slice(cuts[index], end).trim())
    .filter(Boolean);

  const spans = parts.map((part) => locateCopy({ quote: part, text }));

  if (parts.length < 2 || spans.includes(null)) {
    return null;
  }

  const [first, ...rest] = spans
    .filter((span): span is Span => span !== null)
    .toSorted((a, b) => a.start - b.start);

  return rest.reduce<Span | null>(
    (joined, span) =>
      joined && span.start >= joined.end && text.slice(joined.end, span.start).trim() === ""
        ? { end: span.end, start: joined.start }
        : null,
    first ?? null,
  );
}

/** The text's own span for what the model copied, or the copy itself when the text has no such span. */
function findCopy({ quote, text }: { quote: string; text: string }): string {
  const span = locateCopy({ quote, text }) ?? locateReordered({ quote, text });
  return span ? text.slice(span.start, span.end) : quote;
}

/** Where the quote sits in the text's prose: a program can print the same words. */
function findInProse({
  quote,
  spans,
  text,
}: {
  quote: string;
  spans: readonly { end: number; start: number }[];
  text: string;
}): number {
  let start = text.indexOf(quote);

  while (start !== -1 && spans.some((code) => start >= code.start && start < code.end)) {
    start = text.indexOf(quote, start + 1);
  }

  return start;
}

/**
 * A sentence that traces the code block before it, or introduces the one after it, shows the case
 * with that program, so the frame takes the block too and the program never sits outside it.
 */
function withAdjacentCode({ quote, text }: { quote: string; text: string }): string {
  const spans = findCodeSpans(text);
  const start = findInProse({ quote, spans, text });
  const end = start + quote.length;

  if (start === -1 || spans.some((code) => code.start >= start && code.end <= end)) {
    return quote;
  }

  const traced = spans.find(
    (code) => code.end <= start && text.slice(code.end, start).trim() === "",
  );

  const introduced = INTRODUCES.test(quote)
    ? spans.find((code) => code.start >= end && text.slice(end, code.start).trim() === "")
    : undefined;

  return text.slice(traced?.start ?? start, introduced?.end ?? end);
}

/** The text's own span for an example the model copied, widened to what the frame must not split. */
export function fitExampleQuote({ quote, text }: { quote: string; text: string }): string {
  const copied = findCopy({ quote, text });
  return withAdjacentCode({ quote: withListMarker({ quote: copied, text }), text });
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
