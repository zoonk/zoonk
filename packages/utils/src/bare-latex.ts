import { parseInlineMarkupRanges } from "./inline-markup";
import { findMarkdownTableLines } from "./markdown-table";
import { type MathSpan, findMath } from "./math-spans";

/** A backslash before any other word is a file path or an escape a writer meant as text. */
const MATH_COMMANDS = [
  "alpha",
  "approx",
  "beta",
  "cdot",
  "Delta",
  "delta",
  "dfrac",
  "div",
  "frac",
  "geq",
  "infty",
  "lambda",
  "leq",
  "neq",
  "pi",
  "pm",
  "sqrt",
  "sum",
  "text",
  "theta",
  "times",
];

const MATH_COMMAND = new RegExp(String.raw`\\(?:${MATH_COMMANDS.join("|")})(?![A-Za-z])`, "u");
const BRACED_SCRIPT = /[\^_]\{/u;

/** KaTeX raises only the next character, so `10^12` and `10^-1` need their power braced. */
const CARET_POWER =
  /(?<=[\p{L}\p{N})\]}])\^(?<power>-?\p{N}+(?:\.\p{N}+)?|\p{L}(?![\p{L}\p{N}]))/gu;

const HAS_CARET_POWER = new RegExp(CARET_POWER.source, "u");

/** A run of text without spaces, except inside braces, so `\frac{a + b}{2}` stays one piece. */
const CHUNK = /(?:\{(?:[^{}]|\{[^{}]*\})*\}|[^\s{}])+/gu;

const PUNCTUATION_BEFORE = /^["'“‘«¿¡*_]/u;
const PUNCTUATION_AFTER = /[.,;:!?"'”’»*_]$/u;

type BareLatex = { end: number; latex: string; start: number; written: string };

function findMathSpans(line: string): MathSpan[] {
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

function blank(text: string, { end, start }: { end: number; start: number }): string {
  return `${text.slice(0, start)}${" ".repeat(end - start)}${text.slice(end)}`;
}

/** Spaces of the same length keep positions pointing into the line. */
function hideMathAndCode(line: string): string {
  const withoutMath = findMathSpans(line).reduce((text, span) => blank(text, span), line);

  return parseInlineMarkupRanges(withoutMath)
    .filter((range) => range.kind === "code")
    .reduce((text, range) => blank(text, range), withoutMath);
}

function count(text: string, character: string): number {
  return text.split(character).length - 1;
}

function isUnpairedClose(text: string): boolean {
  const last = text.at(-1);

  return (
    (last === ")" && count(text, ")") > count(text, "(")) ||
    (last === "]" && count(text, "]") > count(text, "["))
  );
}

function isUnpairedOpen(text: string): boolean {
  const first = text.at(0);

  return (
    (first === "(" && count(text, "(") > count(text, ")")) ||
    (first === "[" && count(text, "[") > count(text, "]"))
  );
}

function trimStart(text: string): string {
  return PUNCTUATION_BEFORE.test(text) || isUnpairedOpen(text) ? trimStart(text.slice(1)) : text;
}

function trimEnd(text: string): string {
  return PUNCTUATION_AFTER.test(text) || isUnpairedClose(text) ? trimEnd(text.slice(0, -1)) : text;
}

function isLatex(text: string): boolean {
  return BRACED_SCRIPT.test(text) || MATH_COMMAND.test(text) || HAS_CARET_POWER.test(text);
}

function toBareLatex({ chunk, index }: { chunk: string; index: number }): BareLatex | null {
  const opened = trimStart(chunk);
  const written = trimEnd(opened);
  const start = index + chunk.length - opened.length;

  if (!isLatex(written)) {
    return null;
  }

  return {
    end: start + written.length,
    latex: written.replaceAll(CARET_POWER, (_power, power: string) => `^{${power}}`),
    start,
    written,
  };
}

function findBareLatexIn(hidden: string): BareLatex[] {
  return [...hidden.matchAll(CHUNK)].flatMap(
    (match) => toBareLatex({ chunk: match[0], index: match.index }) ?? [],
  );
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

/** A `$` the line already has, such as a price's, can pair with a new one; then the line stays. */
function wrapLine(line: string): string {
  const hidden = hideMathAndCode(line);
  const pieces = findBareLatexIn(hidden);

  if (pieces.length === 0 || isInEmphasis({ hidden, pieces })) {
    return line;
  }

  const wrapped = pieces
    .toReversed()
    .reduce(
      (text, piece) => `${text.slice(0, piece.start)}$${piece.latex}$${text.slice(piece.end)}`,
      line,
    );

  const expected = [
    ...findMathSpans(line),
    ...pieces.map((piece) => ({ content: piece.latex, start: piece.start })),
  ];

  return hasSameMath(findMathSpans(wrapped), expected) ? wrapped : line;
}

/** The player reads each line, and each table cell, on its own. */
function splitLines(text: string): string[][] {
  const lines = text.split("\n");
  const tableLines = findMarkdownTableLines(lines);

  return lines.map((line, index) => (tableLines.has(index) ? line.split("|") : [line]));
}

/** After `wrapBareLatex`, what's left sits in bold or italics or beside another dollar sign. */
export function findBareLatex(text: string): string[] {
  return splitLines(text)
    .flat()
    .flatMap((line) =>
      findBareLatexIn(hideMathAndCode(line)).map(
        ({ latex, written }) =>
          String.raw`Shows math as raw text: "${written}". Write it between dollar signs, as $${latex}$, outside bold or italics, and any other dollar sign in that line as \$.`,
      ),
    );
}

export function wrapBareLatex(text: string): string {
  return splitLines(text)
    .map((cells) => cells.map((cell) => wrapLine(cell)).join("|"))
    .join("\n");
}
