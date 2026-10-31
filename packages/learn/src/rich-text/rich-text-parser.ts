import { parseInlineMarkup } from "@zoonk/utils/inline-markup";
import { type MarkdownTableAlign, readMarkdownTable } from "@zoonk/utils/markdown-table";
import { type RichInlineSegment } from "./rich-inline-segments";

/**
 * Emphasis, short lists, GFM tables, inline code and `$...$` math only, so generated headings or
 * links can never change the player's layout.
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

function isCurrencySign(text: string, index: number): boolean {
  return (
    UPPERCASE_LETTER.test(text[index - 1] ?? "") && PRICE_AFTER_SIGN.test(text.slice(index + 1))
  );
}

function isDelimiter(text: string, index: number): boolean {
  return !isEscaped(text, index) && !isCurrencySign(text, index);
}

/**
 * Pandoc's rule: a closing `$` has text right before it and no digit right after, so "$5 and $10"
 * stay text.
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

function findDollarMath(text: string, from = 0): (Span & { display: boolean }) | null {
  const start = text.indexOf("$", from);

  if (start === -1) {
    return null;
  }

  const span = isDelimiter(text, start) ? matchMathAt(text, start) : null;
  return span ?? findDollarMath(text, start + 1);
}

function findMath(text: string): (Span & { display: boolean }) | null {
  const dollar = findDollarMath(text);

  const delimiters = [
    { close: String.raw`\\)`, display: false, open: String.raw`\\(` },
    { close: String.raw`\\]`, display: true, open: String.raw`\\[` },
    { close: String.raw`\)`, display: false, open: String.raw`\(` },
    { close: String.raw`\]`, display: true, open: String.raw`\[` },
  ];

  const brackets = delimiters.flatMap(({ open, close, display }) => {
    const start = text.indexOf(open);
    const end = start === -1 ? -1 : text.indexOf(close, start + open.length);

    return end < 0
      ? []
      : [
          {
            content: text.slice(start + open.length, end),
            display,
            end: end + close.length,
            start,
          },
        ];
  });

  return (
    [...(dollar ? [dollar] : []), ...brackets].toSorted(
      (first, second) => first.start - second.start,
    )[0] ?? null
  );
}

function parseMarkup(text: string): RichInlineSegment[] {
  return parseInlineMarkup(text).map((segment) =>
    segment.kind === "text"
      ? { ...segment, text: segment.text.replaceAll(String.raw`\$`, "$") }
      : segment,
  );
}

export function toOneLine(text: string): string {
  return text.replaceAll(/\s*\n\s*/gu, " ");
}

/**
 * Math first, so emphasis markers never touch LaTeX, then inline code, so its punctuation stays
 * literal.
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

function parseTextLines(lines: readonly string[]): RichBlock[] {
  const classified = lines.map((line) => classifyLine(line));

  return classified.reduce<RichBlock[]>(
    (blocks, line, index) => appendLine(blocks, line, classified[index - 1]),
    [],
  );
}

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

export function parseRichBlocks(text: string): RichBlock[] {
  return readBlocks(text.split(/\r?\n/u), 0);
}

function toShownText(segments: readonly RichInlineSegment[]): string {
  return segments.map((segment) => segment.text).join("");
}

function canSplit(segment: RichInlineSegment): boolean {
  return segment.kind === "text" || segment.kind === "bold" || segment.kind === "italic";
}

function markSegment({
  end,
  segment,
  start,
}: {
  end: number;
  segment: RichInlineSegment;
  start: number;
}): RichInlineSegment[] {
  const from = Math.max(0, start);
  const to = Math.min(segment.text.length, end);

  if (from >= to) {
    return [segment];
  }

  if (!canSplit(segment)) {
    return [{ ...segment, marked: true }];
  }

  return [
    { ...segment, text: segment.text.slice(0, from) },
    { ...segment, marked: true, text: segment.text.slice(from, to) },
    { ...segment, text: segment.text.slice(to) },
  ].filter((piece) => piece.text.length > 0);
}

function markRange({
  end,
  segments,
  start,
}: {
  end: number;
  segments: readonly RichInlineSegment[];
  start: number;
}): RichInlineSegment[] {
  const offsets = segments.map((_, index) => toShownText(segments.slice(0, index)).length);

  return segments.flatMap((segment, index) => {
    const offset = offsets[index] ?? 0;
    return markSegment({ end: end - offset, segment, start: start - offset });
  });
}

function markLine(segments: RichInlineSegment[], quote: string): RichInlineSegment[] | null {
  const start = toShownText(segments).indexOf(quote);
  return start === -1 ? null : markRange({ end: start + quote.length, segments, start });
}

function markLines(
  lines: RichInlineSegment[][],
  quote: string,
): { done: boolean; lines: RichInlineSegment[][] } {
  const marked = lines.map((line) => markLine(line, quote));
  const index = marked.findIndex((line) => line !== null);

  return index === -1
    ? { done: false, lines }
    : { done: true, lines: lines.map((line, at) => (at === index ? (marked[at] ?? line) : line)) };
}

function markBlock(block: RichBlock, quote: string): { block: RichBlock; done: boolean } {
  switch (block.kind) {
    case "paragraph": {
      const { done, lines } = markLines(block.lines, quote);
      return { block: { ...block, lines }, done };
    }
    case "list": {
      const { done, lines } = markLines(block.items, quote);
      return { block: { ...block, items: lines }, done };
    }
    case "table":
      return { block, done: false };
    default:
      throw new Error("Unknown rich text block.");
  }
}

function toShownQuote(quote: string): string {
  const line = classifyLine(quote.trim());
  return line.kind === "blank" ? "" : toShownText(parseRichInline(line.text));
}

export function markRichInline(segments: RichInlineSegment[], quote: string): RichInlineSegment[] {
  const shown = toShownQuote(quote);
  return (shown && markLine(segments, shown)) || segments;
}

export function markRichBlocks(blocks: RichBlock[], quote: string): RichBlock[] {
  const shown = toShownQuote(quote);

  if (!shown) {
    return blocks;
  }

  const marked = blocks.map((block) => markBlock(block, shown));
  const index = marked.findIndex((entry) => entry.done);

  return blocks.map((block, at) => (at === index ? (marked[at]?.block ?? block) : block));
}
