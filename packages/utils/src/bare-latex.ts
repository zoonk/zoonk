import { parseInlineMarkupRanges } from "./inline-markup";
import { splitLinesAndCells } from "./markdown-table";
import { type MathSpan, findMathSpans, hideMath, toOneLine } from "./math-spans";
import { type TextLayout } from "./text-flaws";

/** A caret between two characters, or a braced script, is math a writer left outside `$…$`. */
const RAW_SCRIPT = /\S\^\S|[\^_]\{/u;

/** Trimming took the mark after this caret (`10^?`, `|x|^?`); a lone caret in quotes is a symbol. */
const ENDING_CARET = /[\p{L}\p{N})\]}|]\^$/u;

/**
 * Code repairs only a number raised to a number (`10^{-5}`, `10^3`, `10^−1`), the only kind lessons
 * have shown. Anything else can mean more than one thing (`Fe^3+` is a charge, `10^3-m` a unit,
 * `e^-(x+1)` a grouped power), so a writer fixes it.
 */
const NUMERIC_POWER =
  /^(?<base>\p{N}+(?:\.\p{N}+)?)\^(?:\{(?<braced>[-−]?\p{N}+(?:\.\p{N}+)?)\}|(?<bare>[-−]?\p{N}+))$/u;

/** An em dash joins clauses, never math, so it splits pieces like a space. */
const PIECE = /[^\s—]+/gu;

const PUNCTUATION_BEFORE = /["'“‘«¿¡*_~]/u;
const PUNCTUATION_AFTER = /[.,;:!?%"'”’»*_]/u;
const BRACKETS: Readonly<Record<string, string>> = { "(": ")", "[": "]" };

type BareLatex = { end: number; latex: string | null; start: number; written: string };

function hideMathAndCode(cell: string): string {
  const withoutMath = hideMath(cell);

  return parseInlineMarkupRanges(withoutMath)
    .filter((range) => range.kind === "code")
    .reduce(
      (text, { end, start }) =>
        `${text.slice(0, start)}${" ".repeat(end - start)}${text.slice(end)}`,
      withoutMath,
    );
}

function toLatex(written: string): string | null {
  const groups = NUMERIC_POWER.exec(written)?.groups;
  const power = groups?.braced ?? groups?.bare;
  return groups && power ? `${groups.base}^{${power.replace("−", "-")}}` : null;
}

function count(text: string, character: string): number {
  return text.split(character).length - 1;
}

/** Punctuation around a piece, a bracket it leaves open or closed, or a pair around all of it. */
function trimRange({ end, start, text }: { end: number; start: number; text: string }): {
  end: number;
  start: number;
} {
  const piece = text.slice(start, end);
  const first = piece.at(0) ?? "";
  const last = piece.at(-1) ?? "";
  const close = BRACKETS[first];
  const open = Object.keys(BRACKETS).find((bracket) => BRACKETS[bracket] === last);

  if (piece.length > 1 && close === last) {
    return trimRange({ end: end - 1, start: start + 1, text });
  }

  if (PUNCTUATION_BEFORE.test(first) || (close && count(piece, first) > count(piece, close))) {
    return trimRange({ end, start: start + 1, text });
  }

  if (PUNCTUATION_AFTER.test(last) || (open && count(piece, last) > count(piece, open))) {
    return trimRange({ end: end - 1, start, text });
  }

  return { end, start };
}

function toBareLatex(match: RegExpExecArray): BareLatex | null {
  const { end, start } = trimRange({ end: match[0].length, start: 0, text: match[0] });
  const written = match[0].slice(start, end);

  if (RAW_SCRIPT.test(written)) {
    return { end: match.index + end, latex: toLatex(written), start: match.index + start, written };
  }

  return ENDING_CARET.test(written)
    ? { end: match.index + match[0].length, latex: null, start: match.index, written: match[0] }
    : null;
}

function findBareLatexIn(hidden: string): BareLatex[] {
  return [...hidden.matchAll(PIECE)].flatMap((match) => toBareLatex(match) ?? []);
}

function hasSameMath(found: MathSpan[], expected: { content: string; start: number }[]): boolean {
  const contents = expected
    .toSorted((first, second) => first.start - second.start)
    .map((math) => math.content);

  return (
    found.length === contents.length && found.every((math, at) => math.content === contents[at])
  );
}

/** The player reads emphasis apart on each side of math, so math can't sit inside bold or italics. */
function isInEmphasis({ hidden, pieces }: { hidden: string; pieces: BareLatex[] }): boolean {
  const emphasis = parseInlineMarkupRanges(hidden).filter(
    (range) => range.kind === "bold" || range.kind === "italic",
  );

  return pieces.some((piece) =>
    emphasis.some((range) => range.start <= piece.start && piece.end <= range.end),
  );
}

function insertMath(text: string, pieces: BareLatex[]): string {
  return pieces
    .toReversed()
    .reduce(
      (wrapped, piece) =>
        `${wrapped.slice(0, piece.start)}$${piece.latex}$${wrapped.slice(piece.end)}`,
      text,
    );
}

/** A `$` the line already has, such as a price's, can pair with a new one; then the line stays. */
function wrapLine(line: string): string {
  const hidden = hideMathAndCode(line);
  const pieces = findBareLatexIn(hidden);

  if (
    pieces.length === 0 ||
    pieces.some((piece) => piece.latex === null) ||
    isInEmphasis({ hidden, pieces })
  ) {
    return line;
  }

  const wrapped = insertMath(line, pieces);

  const expected = [
    ...findMathSpans(line),
    ...pieces.map((piece) => ({ content: piece.latex ?? "", start: piece.start })),
  ];

  return hasSameMath(findMathSpans(wrapped), expected) ? wrapped : line;
}

/** The player reads block text line by line and each table cell on its own. */
function toLines({ layout, text }: { layout: TextLayout; text: string }): string[] {
  return layout === "inline" ? [toOneLine(text)] : splitLinesAndCells(text).flat();
}

function describe({ latex, written }: Pick<BareLatex, "latex" | "written">): string {
  const example = latex === null ? "" : `, as $${latex}$`;
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$.`;
}

function findInLine(line: string): string[] {
  return findBareLatexIn(hideMathAndCode(line)).map((piece) => describe(piece));
}

/** After `wrapBareLatex`, what's left is beyond a plain power, in bold or italics, or beside another `$`. */
export function findBareLatex({ layout, text }: { layout: TextLayout; text: string }): string[] {
  return toLines({ layout, text }).flatMap((line) => findInLine(line));
}

/** An inline field comes back on one line, as the player shows it, only when something was wrapped. */
export function wrapBareLatex({ layout, text }: { layout: TextLayout; text: string }): string {
  if (layout === "inline") {
    const line = toOneLine(text);
    const wrapped = wrapLine(line);
    return wrapped === line ? text : wrapped;
  }

  return splitLinesAndCells(text)
    .map((cells) => cells.map((cell) => wrapLine(cell)).join("|"))
    .join("\n");
}
