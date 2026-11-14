import { findCode } from "./inline-markup";
import { splitLinesAndCells } from "./markdown-table";

export type MathSpan = { content: string; display: boolean; end: number; start: number };

const WHITESPACE = /\s/u;
const DIGIT = /\d/u;
const UPPERCASE_LETTER = /\p{Lu}/u;
const PRICE_AFTER_SIGN = /^\s?\d/u;

function isWhitespace(character: string | undefined): boolean {
  return character === undefined || WHITESPACE.test(character);
}

function isEscaped(text: string, index: number): boolean {
  return index > 0 && text[index - 1] === "\\";
}

function isCurrencySign(text: string, index: number): boolean {
  return (
    UPPERCASE_LETTER.test(text[index - 1] ?? "") && PRICE_AFTER_SIGN.test(text.slice(index + 1))
  );
}

function isDelimiter(text: string, index: number): boolean {
  return !isEscaped(text, index) && !isCurrencySign(text, index);
}

/**
 * Inline math never holds an unescaped `$`: if the first one can't close it by Pandoc's rule, the
 * opener isn't math, so in "$5 and the gap is $10^{-5}$" the price stays text.
 */
function findInlineMathClose(text: string, from: number): number | null {
  const index = text.indexOf("$", from);

  if (index === -1) {
    return null;
  }

  if (isEscaped(text, index)) {
    return findInlineMathClose(text, index + 1);
  }

  const isClose =
    !isCurrencySign(text, index) &&
    !isWhitespace(text[index - 1]) &&
    !DIGIT.test(text[index + 1] ?? "");

  return isClose ? index : null;
}

function matchInlineMathAt(text: string, start: number): MathSpan | null {
  if (isWhitespace(text[start + 1])) {
    return null;
  }

  const close = findInlineMathClose(text, start + 2);

  return close === null
    ? null
    : { content: text.slice(start + 1, close), display: false, end: close + 1, start };
}

function findDollarMath(text: string, from = 0): MathSpan | null {
  const start = text.indexOf("$", from);

  if (start === -1) {
    return null;
  }

  if (!isDelimiter(text, start)) {
    return findDollarMath(text, start + 1);
  }

  if (text.startsWith("$$", start)) {
    const close = text.indexOf("$$", start + 2);
    const content = close === -1 ? "" : text.slice(start + 2, close).trim();

    if (content) {
      return { content, display: true, end: close + 2, start };
    }

    return findDollarMath(text, close === -1 ? start + 1 : close + 2);
  }

  return matchInlineMathAt(text, start) ?? findDollarMath(text, start + 1);
}

function findMathOutsideCode(text: string): MathSpan | null {
  const dollar = findDollarMath(text);

  const delimiters = [
    { close: String.raw`\\)`, display: false, open: String.raw`\\(` },
    { close: String.raw`\\]`, display: true, open: String.raw`\\[` },
    { close: String.raw`\)`, display: false, open: String.raw`\(` },
    { close: String.raw`\]`, display: true, open: String.raw`\[` },
  ];

  const brackets = delimiters.flatMap(({ open, close, display }) => {
    const start = text.indexOf(open);
    const end = start === -1 ? -1 : text.indexOf(close, start + open.length);

    return end < 0
      ? []
      : [
          {
            content: text.slice(start + open.length, end),
            display,
            end: end + close.length,
            start,
          },
        ];
  });

  return (
    [...(dollar ? [dollar] : []), ...brackets].toSorted(
      (first, second) => first.start - second.start,
    )[0] ?? null
  );
}

/**
 * The first math in a line, as the web player typesets it. Inline code comes first, as in
 * CommonMark, so a `$` inside it (``Match `^a$|^b$` ``) is code, never a delimiter.
 */
export function findMath(text: string): MathSpan | null {
  const code = findCode(text);

  if (!code) {
    return findMathOutsideCode(text);
  }

  const after = findMath(text.slice(code.end));

  return (
    findMathOutsideCode(text.slice(0, code.start)) ??
    (after && { ...after, end: after.end + code.end, start: after.start + code.end })
  );
}

export function findMathSpans(line: string): MathSpan[] {
  const first = findMath(line);

  if (!first) {
    return [];
  }

  const rest = findMathSpans(line.slice(first.end)).map((span) => ({
    ...span,
    end: span.end + first.end,
    start: span.start + first.end,
  }));

  return [first, ...rest];
}

/** `text` is a formula's content for math, and the line exactly as written between formulas. */
export type MathSegment = {
  end: number;
  kind: "displayMath" | "math" | "text";
  start: number;
  text: string;
};

/** Leaves out empty text between formulas. */
export function splitAtMath(line: string): MathSegment[] {
  const spans = findMathSpans(line);

  const textBetween = (start: number, end: number): MathSegment[] =>
    end > start ? [{ end, kind: "text", start, text: line.slice(start, end) }] : [];

  return [
    ...spans.flatMap((span, index) => [
      ...textBetween(spans[index - 1]?.end ?? 0, span.start),
      {
        end: span.end,
        kind: span.display ? ("displayMath" as const) : ("math" as const),
        start: span.start,
        text: span.content,
      },
    ]),
    ...textBetween(spans.at(-1)?.end ?? 0, line.length),
  ];
}

/** The player shows an inline field as one line, whatever its line breaks. */
export function toOneLine(text: string): string {
  return text.replaceAll(/\s*\n\s*/gu, " ");
}

export function replaceMath(text: string, replace: (formula: MathSegment) => string): string {
  return splitLinesAndCells(text)
    .map((cells) =>
      cells
        .map((cell) =>
          splitAtMath(cell)
            .map((segment) => (segment.kind === "text" ? segment.text : replace(segment)))
            .join(""),
        )
        .join("|"),
    )
    .join("\n");
}

/** Spaces of the same length keep positions pointing into the text. */
export function hideMath(text: string): string {
  return replaceMath(text, ({ end, start }) => " ".repeat(end - start));
}
