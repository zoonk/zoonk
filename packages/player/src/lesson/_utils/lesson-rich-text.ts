import { parseInlineMarkup } from "@zoonk/utils/inline-markup";
import { type MarkdownTableAlign, readMarkdownTable } from "@zoonk/utils/markdown-table";
import { type RichInlineSegment } from "../../components/rich-inline-segments";

/**
 * Lesson text is Markdown limited to emphasis, short lists, GFM tables of data, inline code and
 * `$...$` math. This parser covers exactly that subset, so generated headings or links can never
 * change the player's layout.
 */
export type RichBlock =
  | { kind: "list"; items: RichInlineSegment[][]; ordered: boolean }
  | { kind: "paragraph"; lines: RichInlineSegment[][] }
  | {
      align: MarkdownTableAlign[];
      header: RichInlineSegment[][];
      kind: "table";
      rows: RichInlineSegment[][][];
    };

type Span = { content: string; end: number; start: number };

const WHITESPACE = /\s/u;
const DIGIT = /\d/u;
const UPPERCASE_LETTER = /\p{Lu}/u;
const PRICE_AFTER_SIGN = /^\s?\d/u;
const UNORDERED_ITEM = /^\s*[-*•]\s+(?<text>.+)$/u;
const ORDERED_ITEM = /^\s*\d{1,3}[.)]\s+(?<text>.+)$/u;

function isWhitespace(character: string | undefined): boolean {
  return character === undefined || WHITESPACE.test(character);
}

function isEscaped(text: string, index: number): boolean {
  return index > 0 && text[index - 1] === "\\";
}

/** "R$ 80", "US$5" and "C$ 12" are currency signs, never math delimiters. */
function isCurrencySign(text: string, index: number): boolean {
  return (
    UPPERCASE_LETTER.test(text[index - 1] ?? "") && PRICE_AFTER_SIGN.test(text.slice(index + 1))
  );
}

function isDelimiter(text: string, index: number): boolean {
  return !isEscaped(text, index) && !isCurrencySign(text, index);
}

/**
 * A closing `$` has text right before it and no digit right after, so prices like "$5 and $10"
 * stay text (Pandoc's rule), and a currency sign like "R$ 80" never closes math.
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

function matchMathAt(text: string, start: number): (Span & { display: boolean }) | null {
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

/** The first `$...$` or `$$...$$` span that follows the math rules, searching from `from`. */
function findMath(text: string, from = 0): (Span & { display: boolean }) | null {
  const start = text.indexOf("$", from);

  if (start === -1) {
    return null;
  }

  const span = isDelimiter(text, start) ? matchMathAt(text, start) : null;
  return span ?? findMath(text, start + 1);
}

/** Emphasis and inline code, with an escaped `\$` (a dollar sign that isn't math) as a plain `$`. */
function parseMarkup(text: string): RichInlineSegment[] {
  return parseInlineMarkup(text).map((segment) =>
    segment.kind === "text"
      ? { ...segment, text: segment.text.replaceAll(String.raw`\$`, "$") }
      : segment,
  );
}

/**
 * Parses one line: math first (so emphasis markers never touch LaTeX), then inline code (so its
 * punctuation stays literal), then bold and italics.
 */
export function parseRichInline(text: string): RichInlineSegment[] {
  const math = findMath(text);

  if (!math) {
    return parseMarkup(text);
  }

  return [
    ...parseMarkup(text.slice(0, math.start)),
    { kind: math.display ? "displayMath" : "math", text: math.content },
    ...parseRichInline(text.slice(math.end)),
  ];
}

type LineKind =
  | { kind: "blank" }
  | { kind: "item"; ordered: boolean; text: string }
  | { kind: "text"; text: string };

function classifyLine(line: string): LineKind {
  const unordered = UNORDERED_ITEM.exec(line)?.groups?.text;
  const ordered = ORDERED_ITEM.exec(line)?.groups?.text;

  if (unordered) {
    return { kind: "item", ordered: false, text: unordered };
  }

  if (ordered) {
    return { kind: "item", ordered: true, text: ordered };
  }

  return line.trim() ? { kind: "text", text: line.trim() } : { kind: "blank" };
}

/** Adds a line to the open block when it continues it, or starts a new block. */
function appendLine(
  blocks: RichBlock[],
  line: LineKind,
  previous: LineKind | undefined,
): RichBlock[] {
  const last = blocks.at(-1);
  const head = blocks.slice(0, -1);

  if (line.kind === "blank") {
    return blocks;
  }

  const inline = parseRichInline(line.text);

  if (line.kind === "item") {
    return last?.kind === "list" && last.ordered === line.ordered && previous?.kind === "item"
      ? [...head, { ...last, items: [...last.items, inline] }]
      : [...blocks, { items: [inline], kind: "list", ordered: line.ordered }];
  }

  return last?.kind === "paragraph" && previous?.kind === "text"
    ? [...head, { ...last, lines: [...last.lines, inline] }]
    : [...blocks, { kind: "paragraph", lines: [inline] }];
}

/** The lines between tables as paragraphs and lists. */
function parseTextLines(lines: readonly string[]): RichBlock[] {
  const classified = lines.map((line) => classifyLine(line));

  return classified.reduce<RichBlock[]>(
    (blocks, line, index) => appendLine(blocks, line, classified[index - 1]),
    [],
  );
}

/** Where the text before the next table ends: the table's header line, or the end of the text. */
function findNextTable(lines: readonly string[], from: number) {
  const index = lines.findIndex(
    (_, position) => position >= from && readMarkdownTable(lines, position) !== null,
  );

  return index === -1 ? null : { index, read: readMarkdownTable(lines, index) };
}

function readBlocks(lines: readonly string[], from: number): RichBlock[] {
  const next = findNextTable(lines, from);

  if (!next?.read) {
    return parseTextLines(lines.slice(from));
  }

  const { align, header, rows } = next.read.table;

  const table: RichBlock = {
    align,
    header: header.map((cell) => parseRichInline(cell)),
    kind: "table",
    rows: rows.map((row) => row.map((cell) => parseRichInline(cell))),
  };

  return [
    ...parseTextLines(lines.slice(from, next.index)),
    table,
    ...readBlocks(lines, next.read.end),
  ];
}

/**
 * Splits lesson text into paragraphs (lines separated by a single line break stay together),
 * lists (lines starting with "-", "*", "•" or "1.") and tables of data (GFM pipe tables).
 */
export function parseRichBlocks(text: string): RichBlock[] {
  return readBlocks(text.split(/\r?\n/u), 0);
}
