/**
 * The inline Markdown AI writers use in learner text: `inline code`, **bold** and *italics* (or
 * _italics_). Words a writer quoted in angle quotes («caption» or <<caption>>) read as italics, the
 * way the app shows quoted words, instead of showing the marks. Anything else stays text, so a
 * stray marker never changes a screen's layout.
 */
export type InlineMarkup =
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "text"; text: string };

type Span = { content: string; end: number; start: number };

const WHITESPACE = /\s/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;

function isWhitespace(character: string | undefined): boolean {
  return character === undefined || WHITESPACE.test(character);
}

function findCode(text: string): Span | null {
  const start = text.indexOf("`");
  const end = start === -1 ? -1 : text.indexOf("`", start + 1);

  return end > start + 1 ? { content: text.slice(start + 1, end), end: end + 1, start } : null;
}

/** Angle quotes AI writers use around a quoted word or sentence, each with its closing mark. */
const ANGLE_QUOTES = [
  { close: "»", open: "«" },
  { close: ">>", open: "<<" },
] as const;

/** The first «quoted» or <<quoted>> words on one line, with text inside the marks. */
function findAngleQuote(text: string): Span | null {
  const spans = ANGLE_QUOTES.flatMap(({ close, open }) => {
    const start = text.indexOf(open);
    const end = start === -1 ? -1 : text.indexOf(close, start + open.length);
    const content = end === -1 ? "" : text.slice(start + open.length, end);

    return content.trim() && !content.includes("\n")
      ? [{ content: content.trim(), end: end + close.length, start }]
      : [];
  });

  return spans.toSorted((left, right) => left.start - right.start)[0] ?? null;
}

function findBold(text: string): Span | null {
  const start = text.indexOf("**");
  const end = start === -1 ? -1 : text.indexOf("**", start + 2);

  return end > start + 2 ? { content: text.slice(start + 2, end), end: end + 2, start } : null;
}

/**
 * `_word_` counts only at word edges, so snake_case names stay text; `*word*` needs text right
 * inside both markers, so "2 * 3 * 4" stays text; and a run of markers is never one, so a fill-in
 * blank ("___") stays a blank.
 */
function isItalicOpen(text: string, index: number, marker: string): boolean {
  const before = text[index - 1];
  const after = text[index + 1];
  const opensWord = marker === "*" || before === undefined || !WORD_CHARACTER.test(before);
  return text[index] === marker && opensWord && !isWhitespace(after) && after !== marker;
}

function isItalicClose(text: string, index: number, marker: string): boolean {
  const before = text[index - 1];
  const after = text[index + 1];
  const closesWord = marker === "*" || after === undefined || !WORD_CHARACTER.test(after);
  return text[index] === marker && closesWord && !isWhitespace(before) && before !== marker;
}

function findItalicClose(text: string, marker: string, from: number): number | null {
  const index = text.indexOf(marker, from);

  if (index === -1) {
    return null;
  }

  return isItalicClose(text, index, marker) ? index : findItalicClose(text, marker, index + 1);
}

function findItalic(text: string, from = 0): Span | null {
  const candidates = ["*", "_"].flatMap((marker) => {
    const start = text.indexOf(marker, from);
    return start === -1 ? [] : [{ marker, start }];
  });

  const first = candidates.toSorted((left, right) => left.start - right.start)[0];

  if (!first) {
    return null;
  }

  const close = isItalicOpen(text, first.start, first.marker)
    ? findItalicClose(text, first.marker, first.start + 2)
    : null;

  if (close === null) {
    return findItalic(text, first.start + 1);
  }

  return { content: text.slice(first.start + 1, close), end: close + 1, start: first.start };
}

function plainText(text: string): InlineMarkup[] {
  return text ? [{ kind: "text", text }] : [];
}

function splitAround({
  kind,
  rest,
  span,
  text,
}: {
  kind: InlineMarkup["kind"];
  rest: (text: string) => InlineMarkup[];
  span: Span;
  text: string;
}): InlineMarkup[] {
  return [
    ...rest(text.slice(0, span.start)),
    { kind, text: span.content },
    ...rest(text.slice(span.end)),
  ];
}

type MarkedSpan = Span & { kind: "bold" | "italic" };

/**
 * The first marked span on the line: bold, italics or angle quotes. On a tie, bold wins over the
 * italics inside its markers.
 */
function findFirstMark(text: string): MarkedSpan | null {
  const bold = findBold(text);
  const italic = findItalic(text);
  const quote = findAngleQuote(text);

  const marks: MarkedSpan[] = [
    ...(bold ? [{ ...bold, kind: "bold" as const }] : []),
    ...(italic ? [{ ...italic, kind: "italic" as const }] : []),
    ...(quote ? [{ ...quote, kind: "italic" as const }] : []),
  ];

  return marks.toSorted((left, right) => left.start - right.start)[0] ?? null;
}

function parseEmphasis(text: string): InlineMarkup[] {
  const mark = findFirstMark(text);

  return mark
    ? splitAround({ kind: mark.kind, rest: parseEmphasis, span: mark, text })
    : plainText(text);
}

/** Parses one line: inline code first, so its punctuation stays literal, then bold and italics. */
export function parseInlineMarkup(text: string): InlineMarkup[] {
  const code = findCode(text);

  return code
    ? splitAround({ kind: "code", rest: parseInlineMarkup, span: code, text })
    : parseEmphasis(text);
}
