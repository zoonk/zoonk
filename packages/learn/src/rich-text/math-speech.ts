import { normalizeLatexCommands } from "./latex-source";
import {
  ATTACHED_MARKS,
  BINARY_OPERATORS,
  FUNCTIONS,
  MINUS,
  RELATIONS,
  SPOKEN_SYMBOLS,
  STYLE_COMMANDS,
  SYMBOLS,
  TEXT_COMMANDS,
  UNSPOKEN_COMMANDS,
  toDoubleStruck,
} from "./math-symbols";

export type MathWords = {
  cubed: string;
  fraction: (parts: { denominator: string; numerator: string }) => string;
  power: (exponent: string) => string;
  root: (radicand: string) => string;
  squared: string;
  subscript: (index: string) => string;
};

type Script = "normal" | "subscript" | "superscript";

/** `plain` is the formula as drawn, which decides where operators get their spaces. */
type Piece = { plain: string; spoken: string };

type Read = { end: number; piece: Piece };

type Reader = { source: string; words: MathWords };

const EMPTY: Piece = { plain: "", spoken: "" };
const OPERATOR_GAP = "\u2005";
const SPACES = /\s+/gu;
const COMMAND_NAME = /^\p{L}*/u;
const LEADING_SPACES = /^ */u;

function symbol(text: string): Piece {
  return { plain: text, spoken: SPOKEN_SYMBOLS.get(text) ?? text };
}

function join(...pieces: Piece[]): Piece {
  return pieces.reduce(
    (all, piece) => ({ plain: all.plain + piece.plain, spoken: all.spoken + piece.spoken }),
    EMPTY,
  );
}

function skipSpaces({ at, source }: { at: number; source: string }): number {
  return at + (LEADING_SPACES.exec(source.slice(at))?.[0].length ?? 0);
}

/**
 * A relation or operator gets a space on each side (not in an exponent or index). A sign that
 * starts an expression or follows an operator, a bracket or a comma stays with its number: "−3".
 */
function spaced({ piece, result, style }: { piece: Piece; result: Piece; style: Script }): Piece {
  const isBinary = BINARY_OPERATORS.has(piece.plain);

  if (style !== "normal" || !(isBinary || RELATIONS.has(piece.plain))) {
    return piece;
  }

  const last = result.plain.at(-1);

  if (isBinary && (last === undefined || `${OPERATOR_GAP}([{,`.includes(last))) {
    return piece;
  }

  const gap = { plain: OPERATOR_GAP, spoken: " " };
  return join(gap, piece, gap);
}

function braceDepthChange(character: string): number {
  if (character === "{") {
    return 1;
  }

  return character === "}" ? -1 : 0;
}

function closingBrace({ from, source }: { from: number; source: string }): number {
  const position = { at: from, depth: 1 };

  while (position.at < source.length) {
    position.depth += braceDepthChange(source[position.at] ?? "");

    if (position.depth === 0) {
      return position.at;
    }

    position.at += 1;
  }

  return source.length;
}

function readTextArgument({ at, source }: { at: number; source: string }) {
  const start = skipSpaces({ at, source });

  if (source[start] !== "{") {
    return { end: start, text: "" };
  }

  const close = closingBrace({ from: start + 1, source });
  return { end: close + 1, text: source.slice(start + 1, close).replaceAll("\\", "") };
}

function readScriptArgument({
  at,
  reader,
  style,
}: {
  at: number;
  reader: Reader;
  style: Script;
}): Read {
  const character = reader.source[at];

  if (character === undefined) {
    return { end: at, piece: EMPTY };
  }

  if (character === "{") {
    return readGroup({ from: at + 1, reader, style, until: "}" });
  }

  if (character === "\\") {
    return readCommand({ at, reader, style });
  }

  return { end: at + 1, piece: symbol(character === "-" ? MINUS : character) };
}

function readArgument({ at, reader, style }: { at: number; reader: Reader; style: Script }): Read {
  return readScriptArgument({ at: skipSpaces({ at, source: reader.source }), reader, style });
}

function spokenScript({
  said,
  style,
  words,
}: {
  said: string;
  style: Script;
  words: MathWords;
}): string {
  if (said === "" || ATTACHED_MARKS.has(said)) {
    return said;
  }

  if (style === "subscript") {
    return ` ${words.subscript(said)} `;
  }

  if (said === "2") {
    return ` ${words.squared} `;
  }

  if (said === "3") {
    return ` ${words.cubed} `;
  }

  return ` ${words.power(said)} `;
}

function readScript({ at, reader, style }: { at: number; reader: Reader; style: Script }): Read {
  const { end, piece } = readScriptArgument({ at, reader, style });
  const said = piece.spoken.trim();

  return {
    end,
    piece: { plain: piece.plain, spoken: spokenScript({ said, style, words: reader.words }) },
  };
}

function readFraction({ at, reader }: { at: number; reader: Reader }): Read {
  const numerator = readArgument({ at, reader, style: "superscript" });
  const denominator = readArgument({ at: numerator.end, reader, style: "subscript" });

  const spoken = reader.words.fraction({
    denominator: denominator.piece.spoken.trim(),
    numerator: numerator.piece.spoken.trim(),
  });

  return {
    end: denominator.end,
    piece: { plain: `${numerator.piece.plain}⁄${denominator.piece.plain}`, spoken: ` ${spoken} ` },
  };
}

function readRoot({ at, reader, style }: { at: number; reader: Reader; style: Script }): Read {
  const { end, piece } = readArgument({ at, reader, style });
  const spoken = reader.words.root(piece.spoken.trim());

  return { end, piece: { plain: `√${piece.plain}`, spoken: ` ${spoken} ` } };
}

function functionName({ end, name, source }: { end: number; name: string; source: string }) {
  const next = source.slice(end).trimStart()[0];
  const isApplied = next !== undefined && (/[\p{L}\p{N}]/u.test(next) || next === "\\");

  return isApplied ? { plain: `${name}\u2006`, spoken: `${name} ` } : symbol(name);
}

function readNamedCommand({
  end,
  name,
  reader,
  style,
}: {
  end: number;
  name: string;
  reader: Reader;
  style: Script;
}): Read {
  if (TEXT_COMMANDS.has(name)) {
    const text = readTextArgument({ at: end, source: reader.source });
    return { end: text.end, piece: symbol(text.text) };
  }

  if (STYLE_COMMANDS.has(name)) {
    return readArgument({ at: end, reader, style });
  }

  switch (name) {
    case "mathbb": {
      const text = readTextArgument({ at: end, source: reader.source });
      return { end: text.end, piece: symbol(toDoubleStruck(text.text)) };
    }
    case "frac":
    case "dfrac":
    case "tfrac":
      return readFraction({ at: end, reader });
    case "sqrt":
      return readRoot({ at: end, reader, style });
    case "begin":
    case "end":
      return { end: readTextArgument({ at: end, source: reader.source }).end, piece: EMPTY };
    case "quad":
    case "qquad":
      return { end, piece: symbol("  ") };
    default:
      break;
  }

  if (UNSPOKEN_COMMANDS.has(name)) {
    return { end, piece: EMPTY };
  }

  if (FUNCTIONS.has(name)) {
    return { end, piece: functionName({ end, name, source: reader.source }) };
  }

  return { end, piece: symbol(SYMBOLS.get(name) ?? name) };
}

function readEscaped({ at, source }: { at: number; source: string }): Read {
  const character = source[at];

  if (character === undefined || character === "!") {
    return { end: Math.min(at + 1, source.length), piece: EMPTY };
  }

  return { end: at + 1, piece: symbol(",;: \\".includes(character) ? " " : character) };
}

function readCommand({ at, reader, style }: { at: number; reader: Reader; style: Script }): Read {
  const name = COMMAND_NAME.exec(reader.source.slice(at + 1))?.[0] ?? "";
  const end = at + 1 + name.length;

  return name
    ? readNamedCommand({ end, name, reader, style })
    : readEscaped({ at: end, source: reader.source });
}

function readToken({
  at,
  reader,
  result,
  style,
}: {
  at: number;
  reader: Reader;
  result: Piece;
  style: Script;
}): Read {
  const character = reader.source[at] ?? "";

  switch (character) {
    case "\\": {
      const command = readCommand({ at, reader, style });
      return { end: command.end, piece: spaced({ piece: command.piece, result, style }) };
    }
    case "{":
      return readGroup({ from: at + 1, reader, style, until: "}" });
    case "^":
      return readScript({ at: at + 1, reader, style: "superscript" });
    case "_":
      return readScript({ at: at + 1, reader, style: "subscript" });
    case " ":
    case "&":
    case "\n":
    case "\t":
      return { end: at + 1, piece: EMPTY };
    case "~":
      return { end: at + 1, piece: symbol(" ") };
    default: {
      const piece = symbol(character === "-" ? MINUS : character);
      return { end: at + 1, piece: spaced({ piece, result, style }) };
    }
  }
}

/** A loop, not recursion per token, so a long formula can't run out of stack. */
function readGroup({
  from,
  reader,
  style,
  until,
}: {
  from: number;
  reader: Reader;
  style: Script;
  until: "}" | null;
}): Read {
  const position = { at: from, piece: EMPTY };

  while (position.at < reader.source.length) {
    if (reader.source[position.at] === until) {
      return { end: position.at + 1, piece: position.piece };
    }

    const token = readToken({ at: position.at, reader, result: position.piece, style });
    position.at = token.end;
    position.piece = join(position.piece, token.piece);
  }

  return { end: position.at, piece: position.piece };
}

/**
 * A formula in the learner's words, as Android's `typesetMath` says it to TalkBack and as screen
 * readers read the MathML that KaTeX draws: "x squared", "1 over 4".
 */
export function speakMath({ latex, words }: { latex: string; words: MathWords }): string {
  const reader = { source: normalizeLatexCommands(latex), words };
  const { piece } = readGroup({ from: 0, reader, style: "normal", until: null });

  return piece.spoken.trim().replaceAll(SPACES, " ");
}
