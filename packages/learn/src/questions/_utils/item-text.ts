import {
  type MarkdownTableAlign,
  isMarkdownTableStart,
  readMarkdownTable,
} from "@zoonk/utils/markdown-table";
import { type RichInlineSegment } from "../../rich-text/rich-inline-segments";
import { parseRichInline } from "../../rich-text/rich-text-parser";

/**
 * Paragraphs, GFM pipe tables, and lesson inline text (code, bold, italics and `$…$` math), as item
 * writers are told; anything else stays text.
 */
export type ItemTextBlock =
  | { kind: "paragraph"; lines: RichInlineSegment[][] }
  | {
      align: MarkdownTableAlign[];
      header: RichInlineSegment[][];
      kind: "table";
      rows: RichInlineSegment[][][];
    };

const LINE_BREAKS = /\s*\r?\n\s*/gu;
const SIGN_THEN_AMOUNT = /(?<sign>\p{Sc})[ \t](?=\d)/gu;
const AMOUNT_THEN_SIGN = /(?<digit>\d)[ \t](?=[\p{Sc}%])/gu;
const NO_BREAK_SPACE = "\u00A0";

function keepAmountsTogether(text: string): string {
  return text
    .replaceAll(SIGN_THEN_AMOUNT, `$<sign>${NO_BREAK_SPACE}`)
    .replaceAll(AMOUNT_THEN_SIGN, `$<digit>${NO_BREAK_SPACE}`);
}

function isProse(segment: RichInlineSegment): boolean {
  return segment.kind === "text" || segment.kind === "bold" || segment.kind === "italic";
}

function parseInline(text: string): RichInlineSegment[] {
  return parseRichInline(text).map((segment) =>
    isProse(segment) ? { ...segment, text: keepAmountsTogether(segment.text) } : segment,
  );
}

function toLines(segments: readonly RichInlineSegment[]): RichInlineSegment[][] {
  return segments.reduce<RichInlineSegment[][]>(
    (lines, segment) =>
      (isProse(segment) ? segment.text.split("\n") : [segment.text]).reduce(
        (current, text, index) => {
          const piece = text ? [{ ...segment, text }] : [];

          return index === 0
            ? [...current.slice(0, -1), [...(current.at(-1) ?? []), ...piece]]
            : [...current, piece];
        },
        lines,
      ),
    [[]],
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

  const text = lines
    .slice(index, end)
    .map((line) => line.trim())
    .join("\n");

  const paragraph = toLines(parseInline(text));

  return [{ kind: "paragraph", lines: paragraph }, ...readBlocks(lines, end)];
}

export function parseItemText(text: string): ItemTextBlock[] {
  return readBlocks(text.split(/\r?\n/u), 0);
}

export function parseItemLine(text: string): RichInlineSegment[] {
  return parseInline(text.trim().replaceAll(LINE_BREAKS, " "));
}
