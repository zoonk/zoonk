import { findCodeFences, removeCodeFences } from "@zoonk/utils/code-fence";
import { type InlineMarkup, parseInlineMarkupRanges } from "@zoonk/utils/inline-markup";

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
const LEADING_BOLD = /^(?:\*\*)+/u;

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
    !LOWERCASE_START.test(quote.replace(LEADING_BOLD, "")) &&
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
    !LOWERCASE_START.test(next.replace(LEADING_BOLD, "")) &&
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

const INLINE_MARK = /[`*]/u;
const INTRODUCES = /[:：]$/u;

type Span = { end: number; start: number };

/** How many characters open and close each mark a copy may leave out. */
const MARK_SIZE: Partial<Record<InlineMarkup["kind"], number>> = { bold: 2, code: 1 };

/** Where the prose's inline code and bold marks sit; what's inside them stays as written. */
function findMarkPlaces(text: string): Set<number> {
  const bounds = [0, ...findCodeSpans(text).flatMap(({ end, start }) => [start, end]), text.length];

  return new Set(
    bounds.flatMap((from, index) =>
      index % 2 === 0
        ? parseInlineMarkupRanges(text.slice(from, bounds[index + 1])).flatMap((range) =>
            Array.from({ length: MARK_SIZE[range.kind] ?? 0 }, (_, at) => [
              from + range.start + at,
              from + range.end - 1 - at,
            ]).flat(),
          )
        : [],
    ),
  );
}

/**
 * The text as a model copies it: prose without its inline code and bold marks and with single
 * line breaks, since models drop a blank line; everything else as written. `offsets` holds each
 * kept character's place.
 */
function readCopy(text: string): { offsets: number[]; value: string } {
  const code = findCodeSpans(text);
  const marks = findMarkPlaces(text);

  return text.split("").reduce<{ offsets: number[]; value: string }>(
    (read, char, at) => {
      const inCode = code.some((span) => at >= span.start && at < span.end);

      if (
        char === "\r" ||
        marks.has(at) ||
        (!inCode && char === "\n" && read.value.endsWith("\n"))
      ) {
        return read;
      }

      read.offsets.push(at);
      return { offsets: read.offsets, value: read.value + char };
    },
    { offsets: [], value: "" },
  );
}

function occurrences({ of, within }: { of: string; within: string }): number[] {
  const found: number[] = [];

  for (let at = of ? within.indexOf(of) : -1; at !== -1; at = within.indexOf(of, at + 1)) {
    found.push(at);
  }

  return found;
}

/**
 * Every place the text holds what the model copied: word for word first, then with the blank lines
 * and inline marks the copy dropped.
 */
function locateCopies({ quote, text }: { quote: string; text: string }): Span[] {
  const copy = readCopy(quote).value.trim();
  const { offsets, value } = readCopy(text);

  return [
    ...occurrences({ of: quote, within: text }).map((at) => ({
      end: at + quote.length,
      start: at,
    })),
    ...occurrences({ of: copy, within: value }).map((at) => ({
      end: (offsets[at + copy.length - 1] ?? 0) + 1,
      start: offsets[at] ?? 0,
    })),
  ];
}

/** The copies seen swap a block and its intro; more parts would make the search grow by their factorial. */
const MAX_REORDERED_PARTS = 4;

/** A model sometimes copies a block ahead of the sentence that introduces it; the text's order stands. */
function locateReordered({ quote, text }: { quote: string; text: string }): Span[] {
  const cuts = [0, ...findCodeSpans(quote).flatMap(({ end, start }) => [start, end]), quote.length];

  const places = cuts
    .slice(1)
    .map((end, index) => quote.slice(cuts[index], end))
    .filter((part) => part.trim() !== "")
    .map((part) => locateCopies({ quote: part, text }));

  if (places.length < 2 || places.length > MAX_REORDERED_PARTS) {
    return [];
  }

  const extend = (span: Span, left: readonly Span[][]): Span[] =>
    left.length === 0
      ? [span]
      : left.flatMap((spans, index) =>
          spans
            .filter(
              (next) => next.start >= span.end && text.slice(span.end, next.start).trim() === "",
            )
            .flatMap((next) =>
              extend({ end: next.end, start: span.start }, left.toSpliced(index, 1)),
            ),
        );

  return places.flatMap((spans, index) =>
    spans.flatMap((span) => extend(span, places.toSpliced(index, 1))),
  );
}

/** A copy that left out the marks around it ("**Try it.**") takes them back. */
function withMarks({ span, text }: { span: Span; text: string }): Span {
  let { end, start } = span;

  while (INLINE_MARK.test(text[start - 1] ?? "")) {
    start -= 1;
  }

  while (INLINE_MARK.test(text[end] ?? "")) {
    end += 1;
  }

  return { end, start };
}

/** A quote of a numbered item's words, widened to its marker ("2. ") so the item keeps its number. */
function withListMarker({ span, text }: { span: Span; text: string }): Span {
  const marker = LIST_MARKER.exec(text.slice(0, span.start));
  return marker ? { ...span, start: span.start - marker[0].trimStart().length } : span;
}

/**
 * A sentence that traces the code block before it, or introduces the one after it, shows the case
 * with that program, so the frame takes the block too and the program never sits outside it.
 */
function withAdjacentCode({ span, text }: { span: Span; text: string }): Span {
  const { end, start } = span;
  const spans = findCodeSpans(text);

  if (spans.some((code) => code.start >= start && code.end <= end)) {
    return span;
  }

  const traced = spans.find(
    (code) => code.end <= start && text.slice(code.end, start).trim() === "",
  );

  const introduced = INTRODUCES.test(text.slice(start, end))
    ? spans.find((code) => code.start >= end && text.slice(end, code.start).trim() === "")
    : undefined;

  return { end: introduced?.end ?? end, start: traced?.start ?? start };
}

/**
 * The text's own span for an example the model copied, widened to what the frame must not split.
 * A program can print the same words as the prose, so the first place that makes a frame wins.
 */
export function fitExampleQuote({ quote, text }: { quote: string; text: string }): string {
  const copies = locateCopies({ quote, text });

  const fitted = (copies.length > 0 ? copies : locateReordered({ quote, text })).map((span) => {
    const widened = withAdjacentCode({
      span: withListMarker({ span: withMarks({ span, text }), text }),
      text,
    });

    return text.slice(widened.start, widened.end);
  });

  return fitted.find((example) => isExampleQuote({ quote: example, text })) ?? fitted[0] ?? quote;
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
