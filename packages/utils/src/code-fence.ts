import { parseInlineMarkupRanges } from "./inline-markup";

/**
 * A CommonMark fenced code block, written with backticks or tildes and closed by a line of the same
 * character at least as long. A backtick fence's info string can't hold a backtick, so "```x```"
 * stays inline code. A line may end in the "\r" of a Windows line break.
 */
const OPENING_FENCE = /^(?<indent> {0,3})(?<fence>`{3,}(?=[^`]*$)|~{3,})(?<info>.*)\r?$/u;
const CLOSING_FENCE = /^ {0,3}(?<fence>`{3,}|~{3,}) *\r?$/u;

/** `end` is the line after the closing fence; a fence that never closes runs to the text's end. */
export type CodeFence = { closed: boolean; code: string; end: number; language: string | null };

function readLanguage(info: string): string | null {
  return info.trim().split(/\s/u)[0]?.toLowerCase() || null;
}

/** A fence is one character repeated, so a closing one as long or longer starts with the opening one. */
function closes({ fence, line }: { fence: string; line: string }): boolean {
  return (CLOSING_FENCE.exec(line)?.groups?.fence ?? "").startsWith(fence);
}

const LEADING_SPACES = /^ */u;

/** A fence indented in a list item lines its code up with it, so its code starts that far in. */
function unindent({ indent, line }: { indent: number; line: string }): string {
  return line.slice(Math.min(indent, LEADING_SPACES.exec(line)?.[0].length ?? 0));
}

/** Code lines stay exactly as written, less the opening fence's own indentation. */
export function readCodeFence(lines: readonly string[], index: number): CodeFence | null {
  const { fence, indent = "", info = "" } = OPENING_FENCE.exec(lines[index] ?? "")?.groups ?? {};

  if (!fence) {
    return null;
  }

  const close = lines.findIndex((line, at) => at > index && closes({ fence, line }));

  return {
    closed: close !== -1,
    code: lines
      .slice(index + 1, close === -1 ? lines.length : close)
      .map((line) => unindent({ indent: indent.length, line }))
      .join("\n"),
    end: close === -1 ? lines.length : close + 1,
    language: readLanguage(info),
  };
}

/** A text that is one closed code block and nothing else, such as an answer option that is code. */
export function readWholeCodeFence(text: string): CodeFence | null {
  const lines = text.trim().split(/\r?\n/u);
  const fence = readCodeFence(lines, 0);

  return fence?.closed && fence.end === lines.length ? fence : null;
}

/** Every fence in order, with `start` at its opening line. */
export function findCodeFences(lines: readonly string[]): (CodeFence & { start: number })[] {
  return lines.reduce<(CodeFence & { start: number })[]>((found, _, index) => {
    if (index < (found.at(-1)?.end ?? 0)) {
      return found;
    }

    const fence = readCodeFence(lines, index);

    if (fence) {
      found.push({ ...fence, start: index });
    }

    return found;
  }, []);
}

/** Every line a fence covers, its fences included: players show them as code and parse nothing in them. */
export function findCodeFenceLines(lines: readonly string[]): ReadonlySet<number> {
  return new Set(
    findCodeFences(lines).flatMap(({ end, start }) =>
      Array.from({ length: end - start }, (_, offset) => start + offset),
    ),
  );
}

/** The text a learner reads as prose, for checks that would misread code. */
export function removeCodeFences(text: string): string {
  const lines = text.split(/\r?\n/u);
  const code = findCodeFenceLines(lines);

  return lines.filter((_, index) => !code.has(index)).join("\n");
}

type TextPiece = { code: boolean; text: string };

const LINE_BREAK: TextPiece = { code: false, text: "\n" };

/** A line's inline code as the players read it, each line on its own. */
function splitLineAtCode(line: string): TextPiece[] {
  const spans = parseInlineMarkupRanges(line).filter((range) => range.kind === "code");

  return [
    ...spans.flatMap(({ end, start }, index) => [
      { code: false, text: line.slice(spans[index - 1]?.end ?? 0, start) },
      { code: true, text: line.slice(start, end) },
    ]),
    { code: false, text: line.slice(spans.at(-1)?.end ?? 0) },
  ];
}

function joinProse(pieces: readonly TextPiece[]): TextPiece[] {
  const joined: TextPiece[] = [];

  for (const piece of pieces.filter(({ text }) => text)) {
    const last = joined.at(-1);

    if (last && !last.code && !piece.code) {
      last.text += piece.text;
    } else {
      joined.push({ ...piece });
    }
  }

  return joined;
}

/**
 * Prose and code in turn, joining back into the text: each code block whole, fences included, and
 * each inline code span with its backticks. A rewrite of the prose leaves code as written.
 */
function splitAtCode(text: string): TextPiece[] {
  const lines = text.split("\n");

  const { from, rows } = findCodeFences(lines).reduce<{ from: number; rows: TextPiece[][] }>(
    (read, { end, start }) => ({
      from: end,
      rows: [
        ...read.rows,
        ...lines.slice(read.from, start).map((line) => splitLineAtCode(line)),
        [{ code: true, text: lines.slice(start, end).join("\n") }],
      ],
    }),
    { from: 0, rows: [] },
  );

  return joinProse(
    [...rows, ...lines.slice(from).map((line) => splitLineAtCode(line))].flatMap((row, index) =>
      index === 0 ? row : [LINE_BREAK, ...row],
    ),
  );
}

/** The prose alone, a space standing where each code block or inline code was. */
export function removeCode(text: string): string {
  return splitAtCode(text)
    .map((piece) => (piece.code ? " " : piece.text))
    .join("");
}

const FIRST_STAND_IN = "\u{F0000}".codePointAt(0) ?? 0;
const STAND_IN = /[\u{F0000}-\u{FFFFD}]/gu;

/**
 * Rewrites the prose and keeps every character of code as written. Each piece of code stands in as
 * one private-use character, so the edit still reads a link or a sentence around code whole.
 */
export function editProse(text: string, edit: (prose: string) => string): string {
  const pieces = splitAtCode(text);
  const code = pieces.filter((piece) => piece.code);

  if (code.length === 0) {
    return edit(text);
  }

  const prose = pieces
    .map((piece) =>
      piece.code ? String.fromCodePoint(FIRST_STAND_IN + code.indexOf(piece)) : piece.text,
    )
    .join("");

  return edit(prose).replaceAll(
    STAND_IN,
    (standIn) => code[(standIn.codePointAt(0) ?? 0) - FIRST_STAND_IN]?.text ?? standIn,
  );
}
