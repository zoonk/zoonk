import { renderToString } from "katex";
import { parseInlineMarkupRanges } from "./inline-markup";
import { splitLinesAndCells } from "./markdown-table";
import { type MathSpan, findMathSpans, hideMath, normalizeLatexCommands } from "./math-spans";

/**
 * Outside braces, a backslash before any other word is a file path or an escape a writer meant as
 * text (`C:\text\notes.txt`); inside braces it may be a command KaTeX lacks, so a writer fixes it.
 */
const MATH_COMMANDS = new Set([
  "alpha",
  "approx",
  "beta",
  "cdot",
  "cdots",
  "circ",
  "cos",
  "Delta",
  "delta",
  "dfrac",
  "div",
  "epsilon",
  "exp",
  "frac",
  "gamma",
  "ge",
  "geq",
  "infty",
  "int",
  "lambda",
  "ldots",
  "le",
  "leq",
  "lim",
  "ln",
  "log",
  "mathrm",
  "mu",
  "ne",
  "neq",
  "Omega",
  "omega",
  "partial",
  "phi",
  "pi",
  "pm",
  "rho",
  "rightarrow",
  "Sigma",
  "sigma",
  "sin",
  "sqrt",
  "sum",
  "tan",
  "text",
  "theta",
  "times",
  "to",
]);

const BACKSLASH_WORD = /\\(?<name>[A-Za-z]+)/gu;

/** A drive (`C:\`) or a file name with its extension (`\log.txt`), outside a formula's braces. */
const FILE_PATH = /^[A-Za-z]:\\|\\[A-Za-z]+\.[A-Za-z]/u;
const BRACED_SCRIPT = /[\^_]\{/u;

/** KaTeX raises only the next character, so `10^12` and `10^-1` need their power braced. */
const CARET_POWER =
  /(?<=[\p{L}\p{N})\]}])\^(?<power>[-−]?\p{N}+(?:\.\p{N}+)?|\p{L}(?![\p{L}\p{N}]))/gu;

const HAS_CARET_POWER = new RegExp(CARET_POWER.source, "u");

/** `10^3,5` is a decimal power in some languages and two numbers in others; a writer decides. */
const COMMA_AFTER_POWER = /\^[-−]?\p{N}+,\p{N}/u;

const INNER_BRACE_GROUP = /\{[^{}]*\}/gu;
const BRACE_STEP: Readonly<Record<string, number>> = { "{": 1, "}": -1 };
/** An em dash joins clauses, never math, so it splits pieces like a space; an en dash can be a minus. */
const SEPARATOR = /[\s—]/u;
const CHUNK_MASK = /x+/gu;
const NOT_SEPARATOR = /[^\s—]+/gu;

/** Math subtracts a letter or two (`x^2-xy`); a dash before a longer run attaches a word (`10^3-fold`). */
const ATTACHED_WORD = /[-‐‑–]\p{L}{3,}/u;

const PUNCTUATION_BEFORE = /^["'“‘«¿¡*_~]/u;
const PUNCTUATION_AFTER = /[.,;:!?%"'”’»*_]$/u;

/** KaTeX renders these without an error but not as written: `%` starts a comment and `~` is a space. */
const TEX_SPECIAL = /[%~]/u;

type Command = { inBraces: boolean; name: string };

type BareLatex = {
  end: number;
  latex: string;
  repairable: boolean;
  start: number;
  written: string;
};

function count(text: string, character: string): number {
  return text.split(character).length - 1;
}

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

function findCommands(text: string): Command[] {
  return [...text.matchAll(BACKSLASH_WORD)].map((match) => {
    const before = text.slice(0, match.index);
    return { inBraces: count(before, "{") > count(before, "}"), name: match.groups?.name ?? "" };
  });
}

/** `∅` stands for each group, at any depth, so nothing inside braces reads as a path or a word. */
function collapseBraces(text: string): string {
  const collapsed = text.replaceAll(INNER_BRACE_GROUP, "∅");
  return collapsed === text ? text : collapseBraces(collapsed);
}

/** Separators inside braces at any depth don't split, so `\frac{a + b}{2}` stays one piece. */
function maskSpaces(text: string): { mask: string; nests: boolean } {
  const { depth, mask, nests } = text.split("").reduce(
    (state, character) => {
      const next = state.depth + (BRACE_STEP[character] ?? 0);
      const space = state.depth === 0 && SEPARATOR.test(character);

      return {
        depth: next,
        mask: `${state.mask}${space ? " " : "x"}`,
        nests: state.nests && next >= 0,
      };
    },
    { depth: 0, mask: "", nests: true },
  );

  return { mask, nests: nests && depth === 0 };
}

/** Braces that don't nest can't group a formula, so that text splits at every separator. */
function findChunks(text: string): { chunk: string; index: number }[] {
  const { mask, nests } = maskSpaces(text);

  return [...(nests ? mask : text).matchAll(nests ? CHUNK_MASK : NOT_SEPARATOR)].map((match) => ({
    chunk: text.slice(match.index, match.index + match[0].length),
    index: match.index,
  }));
}

function isLatex({ commands, text }: { commands: Command[]; text: string }): boolean {
  const known = commands.filter((command) => MATH_COMMANDS.has(command.name));

  const isPath =
    FILE_PATH.test(collapseBraces(text)) ||
    commands.some((command) => !command.inBraces && !MATH_COMMANDS.has(command.name));

  return !isPath && (known.length > 0 || BRACED_SCRIPT.test(text) || HAS_CARET_POWER.test(text));
}

/** The player's KaTeX settings, so code wraps only what the player draws without an error. */
function rendersInKatex(latex: string): boolean {
  try {
    renderToString(normalizeLatexCommands(latex), {
      output: "mathml",
      strict: "ignore",
      throwOnError: true,
      trust: false,
    });

    return true;
  } catch {
    return false;
  }
}

function isRepairable({ latex, written }: { latex: string; written: string }): boolean {
  return (
    !TEX_SPECIAL.test(latex) &&
    !COMMA_AFTER_POWER.test(written) &&
    !ATTACHED_WORD.test(collapseBraces(written).replaceAll(BACKSLASH_WORD, "")) &&
    rendersInKatex(latex)
  );
}

function toBareLatex({ chunk, index }: { chunk: string; index: number }): BareLatex | null {
  const opened = trimStart(chunk);
  const written = trimEnd(opened);
  const start = index + chunk.length - opened.length;
  const commands = findCommands(written);

  if (!isLatex({ commands, text: written })) {
    return null;
  }

  const latex = written.replaceAll(
    CARET_POWER,
    (_power, power: string) => `^{${power.replace("−", "-")}}`,
  );

  return {
    end: start + written.length,
    latex,
    repairable: isRepairable({ latex, written }),
    start,
    written,
  };
}

function findBareLatexIn(hidden: string): BareLatex[] {
  return findChunks(hidden).flatMap((chunk) => toBareLatex(chunk) ?? []);
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
    pieces.some((piece) => !piece.repairable) ||
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
    ...pieces.map((piece) => ({ content: piece.latex, start: piece.start })),
  ];

  return hasSameMath(findMathSpans(wrapped), expected) ? wrapped : cell;
}

function describe({ latex, repairable, written }: BareLatex): string {
  const example = repairable ? `, as $${latex}$` : "";
  return String.raw`Shows math as raw text: "${written}". Write it between dollar signs${example}, outside bold or italics, and any other dollar sign in that line as \$.`;
}

/** After `wrapBareLatex`, what's left is in bold or italics, beside another dollar sign, or unclear. */
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
