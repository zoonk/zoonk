import { parseInlineMarkupRanges } from "./inline-markup";
import { CELL_PIPE, findMarkdownTableLines } from "./markdown-table";
import { type MathSpan, findMathSpans, hideMath } from "./math-spans";

/** A backslash before any other word is a file path or an escape a writer meant as text. */
const MATH_COMMANDS = new Set([
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
]);

/** KaTeX reads these commands' arguments only in braces, so `\sqrt 4` can't be wrapped as written. */
const BRACED_COMMANDS = new Set(["dfrac", "frac", "sqrt", "text"]);

const BACKSLASH_WORD = /\\(?<name>[A-Za-z]+)(?=(?<next>.?))/gu;
const BRACED_SCRIPT = /[\^_]\{/u;

/**
 * KaTeX raises only the next character, so `10^12`, `10^-1` and `10^3,5` need their power braced,
 * with a decimal comma braced too so it doesn't read as a list.
 */
const CARET_POWER =
  /(?<=[\p{L}\p{N})\]}])\^(?<power>[-−]?\p{N}+(?:[.,]\p{N}+)?|\p{L}(?![\p{L}\p{N}]))/gu;

const HAS_CARET_POWER = new RegExp(CARET_POWER.source, "u");

/** A run of text without spaces, except inside braces, so `\frac{a + b}{2}` stays one piece. */
const CHUNK = /(?:\{(?:[^{}]|\{[^{}]*\})*\}|[^\s{}])+/gu;

const PUNCTUATION_BEFORE = /^["'“‘«¿¡*_~]/u;
const PUNCTUATION_AFTER = /[.,;:!?%"'”’»*_]$/u;

/** In KaTeX, `%` starts a comment, `~` is a space, and `&` and `#` are errors outside environments. */
const TEX_SPECIAL = /[%~&#]/u;

type BareLatex = {
  end: number;
  latex: string;
  repairable: boolean;
  start: number;
  written: string;
};

function hideMathAndCode(line: string): string {
  const withoutMath = hideMath(line);

  return parseInlineMarkupRanges(withoutMath)
    .filter((range) => range.kind === "code")
    .reduce(
      (text, { end, start }) =>
        `${text.slice(0, start)}${" ".repeat(end - start)}${text.slice(end)}`,
      withoutMath,
    );
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

function findCommands(text: string): { braced: boolean; name: string }[] {
  return [...text.matchAll(BACKSLASH_WORD)].map((match) => ({
    braced: match.groups?.next === "{",
    name: match.groups?.name ?? "",
  }));
}

function isLatex({ commands, text }: { commands: { name: string }[]; text: string }): boolean {
  const known = commands.every((command) => MATH_COMMANDS.has(command.name));

  return known && (commands.length > 0 || BRACED_SCRIPT.test(text) || HAS_CARET_POWER.test(text));
}

function toPower(power: string): string {
  return `^{${power.replace("−", "-").replace(",", "{,}")}}`;
}

function toBareLatex({ chunk, index }: { chunk: string; index: number }): BareLatex | null {
  const opened = trimStart(chunk);
  const written = trimEnd(opened);
  const start = index + chunk.length - opened.length;
  const commands = findCommands(written);

  if (!isLatex({ commands, text: written })) {
    return null;
  }

  const latex = written.replaceAll(CARET_POWER, (_power, power: string) => toPower(power));

  const repairable =
    !TEX_SPECIAL.test(latex) &&
    commands.every((command) => command.braced || !BRACED_COMMANDS.has(command.name));

  return { end: start + written.length, latex, repairable, start, written };
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

  if (
    pieces.length === 0 ||
    pieces.some((piece) => !piece.repairable) ||
    isInEmphasis({ hidden, pieces })
  ) {
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

  return lines.map((line, index) => (tableLines.has(index) ? line.split(CELL_PIPE) : [line]));
}

function describe({ latex, repairable, written }: BareLatex): string {
  const example = repairable ? `, as $${latex}$` : "";
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$.`;
}

/** After `wrapBareLatex`, what's left is in bold or italics, beside another dollar sign, or needs braces. */
export function findBareLatex(text: string): string[] {
  return splitLines(text)
    .flat()
    .flatMap((line) => findBareLatexIn(hideMathAndCode(line)).map((piece) => describe(piece)));
}

export function wrapBareLatex(text: string): string {
  return splitLines(text)
    .map((cells) => cells.map((cell) => wrapLine(cell)).join("|"))
    .join("\n");
}
