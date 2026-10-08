import { type InlineMarkup, parseInlineMarkup } from "@zoonk/utils/inline-markup";
import {
  type MarkdownTableAlign,
  isMarkdownTableStart,
  readMarkdownTable,
} from "@zoonk/utils/markdown-table";

/**
 * Item text (a question's support text and its command) is Markdown limited to paragraphs, GFM
 * pipe tables for data, and inline code, bold and italics, as the item writers are told. Anything
 * else stays text, so a stray marker never changes a question's layout.
 */
export type ItemTextBlock =
  | { kind: "paragraph"; lines: InlineMarkup[][] }
  | {
      align: MarkdownTableAlign[];
      header: InlineMarkup[][];
      kind: "table";
      rows: InlineMarkup[][][];
    };

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

function findParagraphEnd(lines: readonly string[], index: number): number {
  return isBlank(lines[index]) || isMarkdownTableStart(lines, index)
    ? index
    : findParagraphEnd(lines, index + 1);
}

function readBlocks(lines: readonly string[], index: number): ItemTextBlock[] {
  if (index >= lines.length) {
    return [];
  }

  if (isBlank(lines[index])) {
    return readBlocks(lines, index + 1);
  }

  const read = readMarkdownTable(lines, index);

  if (read) {
    const { align, header, rows } = read.table;

    const table: ItemTextBlock = {
      align,
      header: header.map((cell) => parseInline(cell)),
      kind: "table",
      rows: rows.map((row) => row.map((cell) => parseInline(cell))),
    };

    return [table, ...readBlocks(lines, read.end)];
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
