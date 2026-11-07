import { parseInlineMarkupRanges } from "./inline-markup";
import { splitLinesAndCells } from "./markdown-table";
import { type MathSpan, findMathSpans, hideMath } from "./math-spans";

/** A caret between two characters, or a braced script, is math a writer left outside `$…$`. */
const RAW_SCRIPT = /\S\^\S|[\^_]\{/u;

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

  return RAW_SCRIPT.test(written)
    ? { end: match.index + end, latex: toLatex(written), start: match.index + start, written }
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

/** A `$` the cell already has, such as a price's, can pair with a new one; then the cell stays. */
function wrapCell(cell: string): string {
  const hidden = hideMathAndCode(cell);
  const pieces = findBareLatexIn(hidden);

  if (
    pieces.length === 0 ||
    pieces.some((piece) => piece.latex === null) ||
    isInEmphasis({ hidden, pieces })
  ) {
    return cell;
  }

  const wrapped = pieces
    .toReversed()
    .reduce(
      (text, piece) => `${text.slice(0, piece.start)}$${piece.latex}$${text.slice(piece.end)}`,
      cell,
    );

  const expected = [
    ...findMathSpans(cell),
    ...pieces.map((piece) => ({ content: piece.latex ?? "", start: piece.start })),
  ];

  return hasSameMath(findMathSpans(wrapped), expected) ? wrapped : cell;
}

function describe({ latex, written }: BareLatex): string {
  const example = latex === null ? "" : `, as $${latex}$`;
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$.`;
}

/** After `wrapBareLatex`, what's left is beyond a plain power, in bold or italics, or beside another `$`. */
export function findBareLatex(text: string): string[] {
  return splitLinesAndCells(text)
    .flat()
    .flatMap((cell) => findBareLatexIn(hideMathAndCode(cell)).map((piece) => describe(piece)));
}

export function wrapBareLatex(text: string): string {
  return splitLinesAndCells(text)
    .map((cells) => cells.map((cell) => wrapCell(cell)).join("|"))
    .join("\n");
}
