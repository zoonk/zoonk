import { readCodeFence } from "@zoonk/utils/code-fence";
import { isMarkdownTableStart, readMarkdownTable } from "@zoonk/utils/markdown-table";
import { type RichInlineSegment } from "../../rich-text/rich-inline-segments";
import { type RichBlock, parseRichInline, parseRichLine } from "../../rich-text/rich-text-parser";

/**
 * Paragraphs, GFM pipe tables, fenced code blocks and lesson inline text (code, bold, italics and
 * `$…$` math), as item writers are told; anything else stays text. A code block keeps its code
 * exactly as written.
 */
export type ItemTextBlock = Exclude<RichBlock, { kind: "list" }>;

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
  const lines: RichInlineSegment[][] = [[]];

  for (const segment of segments) {
    const parts = isProse(segment) ? segment.text.split("\n") : [segment.text];

    for (const [index, text] of parts.entries()) {
      if (index > 0) {
        lines.push([]);
      }

      if (text) {
        lines.at(-1)?.push({ ...segment, text });
      }
    }
  }

  return lines;
}

function isBlank(line: string | undefined): boolean {
  return line === undefined || line.trim() === "";
}

function findParagraphEnd(lines: readonly string[], index: number): number {
  return isBlank(lines[index]) ||
    isMarkdownTableStart(lines, index) ||
    readCodeFence(lines, index) !== null
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

  const fence = readCodeFence(lines, index);

  if (fence) {
    return [
      { code: fence.code, kind: "code", language: fence.language },
      ...readBlocks(lines, fence.end),
    ];
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
  return parseRichLine({
    parseProse: (prose) => parseInline(prose.trim().replaceAll(LINE_BREAKS, " ")),
    text,
  });
}
