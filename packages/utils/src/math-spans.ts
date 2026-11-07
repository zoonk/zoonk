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
 * Pandoc's rule: a closing `$` has text right before it and no digit right after, so "$5 and $10"
 * stay text.
 */
function findInlineMathClose(text: string, from: number): number | null {
  const index = text.indexOf("$", from);

  if (index === -1) {
    return null;
  }

  const isClose =
    isDelimiter(text, index) &&
    !isWhitespace(text[index - 1]) &&
    !DIGIT.test(text[index + 1] ?? "");

  return isClose ? index : findInlineMathClose(text, index + 1);
}

function matchMathAt(text: string, start: number): MathSpan | null {
  if (text.startsWith("$$", start)) {
    const close = text.indexOf("$$", start + 2);
    const content = close === -1 ? "" : text.slice(start + 2, close).trim();
    return content ? { content, display: true, end: close + 2, start } : null;
  }

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

  const span = isDelimiter(text, start) ? matchMathAt(text, start) : null;
  return span ?? findDollarMath(text, start + 1);
}

/** The first math in a line, as the web player typesets it. */
export function findMath(text: string): MathSpan | null {
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

function hideCellMath(cell: string): string {
  return findMathSpans(cell).reduce(
    (hidden, { end, start }) =>
      `${hidden.slice(0, start)}${" ".repeat(end - start)}${hidden.slice(end)}`,
    cell,
  );
}

/** Spaces of the same length keep positions pointing into the text. */
export function hideMath(text: string): string {
  return splitLinesAndCells(text)
    .map((cells) => cells.map((cell) => hideCellMath(cell)).join("|"))
    .join("\n");
}

/**
 * Structured AI responses can over-escape LaTeX commands (`\\rightarrow`), which KaTeX reads as
 * text.
 */
export function normalizeLatexCommands(text: string) {
  return text.replaceAll(/\\\\[A-Za-z]+/gu, (escapedCommand) => escapedCommand.slice(1));
}
