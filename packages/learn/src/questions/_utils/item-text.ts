import { type InlineMarkup, parseInlineMarkup } from "@zoonk/utils/inline-markup";

/**
 * Item text (a question's support text and its command) is Markdown limited to paragraphs, GFM
 * pipe tables for data, and inline code, bold and italics, as the item writers are told. Anything
 * else stays text, so a stray marker never changes a question's layout.
 */
export type ItemTextAlign = "center" | "left" | "right" | null;

export type ItemTextBlock =
  | { kind: "paragraph"; lines: InlineMarkup[][] }
  | { align: ItemTextAlign[]; header: InlineMarkup[][]; kind: "table"; rows: InlineMarkup[][][] };

const DELIMITER_CELL = /^:?-+:?$/u;
const EDGE_PIPES = /^\||(?<!\\)\|$/gu;
const CELL_PIPE = /(?<!\\)\|/u;
const ESCAPED_PIPE = String.raw`\|`;
const LINE_BREAKS = /\s*\r?\n\s*/gu;
const SIGN_THEN_AMOUNT = /(?<sign>\p{Sc})[ \t](?=\d)/gu;
const AMOUNT_THEN_SIGN = /(?<digit>\d)[ \t](?=[\p{Sc}%])/gu;
const NO_BREAK_SPACE = "\u00A0";

/** "R$ 96,00", "96,00 €" and "40 %" never break across lines. */
function keepAmountsTogether(text: string): string {
  return text
    .replaceAll(SIGN_THEN_AMOUNT, `$<sign>${NO_BREAK_SPACE}`)
    .replaceAll(AMOUNT_THEN_SIGN, `$<digit>${NO_BREAK_SPACE}`);
}

function parseInline(text: string): InlineMarkup[] {
  return parseInlineMarkup(text).map((segment) =>
    segment.kind === "code" ? segment : { ...segment, text: keepAmountsTogether(segment.text) },
  );
}

function isBlank(line: string | undefined): boolean {
  return line === undefined || line.trim() === "";
}

function isRow(line: string | undefined): line is string {
  return line?.includes("|") ?? false;
}

/** A row's cells: pipes at either edge are optional, and `\|` is a pipe inside a cell. */
function splitRow(line: string): string[] {
  return line
    .trim()
    .replaceAll(EDGE_PIPES, "")
    .split(CELL_PIPE)
    .map((cell) => cell.trim().replaceAll(ESCAPED_PIPE, "|"));
}

function toAlign(cell: string): ItemTextAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");

  if (left && right) {
    return "center";
  }

  if (right) {
    return "right";
  }

  return left ? "left" : null;
}

/** The `|---|:---:|` row under a table's header, read as each column's alignment. */
function readDelimiter(line: string | undefined): ItemTextAlign[] | null {
  if (!isRow(line)) {
    return null;
  }

  const cells = splitRow(line);

  return cells.every((cell) => DELIMITER_CELL.test(cell))
    ? cells.map((cell) => toAlign(cell))
    : null;
}

/** A table starts where a row is followed by a delimiter row with as many cells (GFM). */
function readTableStart(lines: readonly string[], index: number): ItemTextAlign[] | null {
  const header = lines[index];
  const align = readDelimiter(lines[index + 1]);

  return isRow(header) && align && splitRow(header).length === align.length ? align : null;
}

/**
 * Where a table's rows stop: at a blank line or a line without a pipe. GFM would keep a sentence
 * written right under a table as one more row; writers mean it as text.
 */
function findRowsEnd(lines: readonly string[], index: number): number {
  return isRow(lines[index]) ? findRowsEnd(lines, index + 1) : index;
}

function findParagraphEnd(lines: readonly string[], index: number): number {
  return isBlank(lines[index]) || readTableStart(lines, index)
    ? index
    : findParagraphEnd(lines, index + 1);
}

/** Every row has the header's cells: missing ones are empty and extra ones are dropped (GFM). */
function toCells(line: string, count: number): InlineMarkup[][] {
  const cells = splitRow(line);
  return Array.from({ length: count }, (_, index) => parseInline(cells[index] ?? ""));
}

function readBlocks(lines: readonly string[], index: number): ItemTextBlock[] {
  if (index >= lines.length) {
    return [];
  }

  if (isBlank(lines[index])) {
    return readBlocks(lines, index + 1);
  }

  const align = readTableStart(lines, index);

  if (align) {
    const end = findRowsEnd(lines, index + 2);

    const table: ItemTextBlock = {
      align,
      header: toCells(lines[index] ?? "", align.length),
      kind: "table",
      rows: lines.slice(index + 2, end).map((line) => toCells(line, align.length)),
    };

    return [table, ...readBlocks(lines, end)];
  }

  const end = findParagraphEnd(lines, index + 1);
  const paragraph = lines.slice(index, end).map((line) => parseInline(line.trim()));

  return [{ kind: "paragraph", lines: paragraph }, ...readBlocks(lines, end)];
}

/**
 * Splits item text into paragraphs (lines separated by a single line break stay together, each
 * on its own line) and tables.
 */
export function parseItemText(text: string): ItemTextBlock[] {
  return readBlocks(text.split(/\r?\n/u), 0);
}

/** One line of item text, such as a question's command, with its line breaks read as spaces. */
export function parseItemLine(text: string): InlineMarkup[] {
  return parseInline(text.trim().replaceAll(LINE_BREAKS, " "));
}
