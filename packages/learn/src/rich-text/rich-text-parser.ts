import { findCodeFences, readCodeFence } from "@zoonk/utils/code-fence";
import { parseInlineMarkup } from "@zoonk/utils/inline-markup";
import { type MarkdownTableAlign, readMarkdownTable } from "@zoonk/utils/markdown-table";
import { findMath } from "@zoonk/utils/math-spans";
import { type RichInlineSegment } from "./rich-inline-segments";

/**
 * Emphasis, short lists, GFM tables, fenced code blocks, inline code and `$...$` math only, so
 * generated headings or links can never change the player's layout. A code block keeps its code
 * exactly as written.
 */
export type RichBlock =
  | { code: string; kind: "code"; language: string | null }
  | { kind: "list"; items: RichInlineSegment[][]; ordered: boolean }
  | { kind: "paragraph"; lines: RichInlineSegment[][] }
  | {
      align: MarkdownTableAlign[];
      header: RichInlineSegment[][];
      kind: "table";
      rows: RichInlineSegment[][][];
    };

const UNORDERED_ITEM = /^\s*[-*•]\s+(?<text>.+)$/u;
const SPACE_BEFORE_PUNCTUATION = /^[ \t]+(?=[.,])/u;
const ORDERED_ITEM = /^\s*\d{1,3}[.)]\s+(?<text>.+)$/u;

function parseMarkup(text: string): RichInlineSegment[] {
  return parseInlineMarkup(text).map((segment, index, segments) => {
    if (segment.kind !== "text") {
      return segment;
    }

    const words = segment.text.replaceAll(String.raw`\$`, "$");

    return {
      ...segment,
      text:
        segments[index - 1]?.kind === "code" ? words.replace(SPACE_BEFORE_PUNCTUATION, "") : words,
    };
  });
}

/**
 * Math first, so emphasis markers never touch LaTeX, then inline code; `findMath` already skips a
 * `$` inside code, so code's punctuation stays literal.
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

export type WholeCodeBlock = { code: string; language: string | null };

/** Text that is one closed code block and nothing else, such as an answer option that is a program. */
export function readWholeCodeBlock(text: string): WholeCodeBlock | null {
  const lines = text.trim().split(/\r?\n/u);
  const fence = readCodeFence(lines, 0);

  return fence?.closed && fence.end === lines.length
    ? { code: fence.code, language: fence.language }
    : null;
}

function toInlineCode(code: string): RichInlineSegment {
  const text = code
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ");

  return { kind: "code", text };
}

const SPACE: RichInlineSegment = { kind: "text", text: " " };

/**
 * Text drawn on one line, such as a heading or an answer quoted in a sentence: `parseProse` reads
 * its words, and a code block in it reads as one run of inline code.
 */
export function parseRichLine({
  parseProse,
  text,
}: {
  parseProse: (prose: string) => RichInlineSegment[];
  text: string;
}): RichInlineSegment[] {
  const lines = text.split(/\r?\n/u);
  const fences = findCodeFences(lines);

  if (fences.length === 0) {
    return parseProse(text);
  }

  const read = fences.reduce<{ from: number; pieces: RichInlineSegment[][] }>(
    ({ from, pieces }, fence) => ({
      from: fence.end,
      pieces: [
        ...pieces,
        parseProse(lines.slice(from, fence.start).join("\n")),
        [toInlineCode(fence.code)],
      ],
    }),
    { from: 0, pieces: [] },
  );

  return [...read.pieces, parseProse(lines.slice(read.from).join("\n"))]
    .filter((piece) => piece.some((segment) => segment.text.trim()))
    .flatMap((piece, index) => (index === 0 ? piece : [SPACE, ...piece]));
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

/** A code block or a table that starts on this line, with the line after it. */
function readBlockAt(
  lines: readonly string[],
  index: number,
): { block: RichBlock; end: number } | null {
  const fence = readCodeFence(lines, index);

  if (fence) {
    return { block: { code: fence.code, kind: "code", language: fence.language }, end: fence.end };
  }

  const read = readMarkdownTable(lines, index);

  if (!read) {
    return null;
  }

  const { align, header, rows } = read.table;

  return {
    block: {
      align,
      header: header.map((cell) => parseRichInline(cell)),
      kind: "table",
      rows: rows.map((row) => row.map((cell) => parseRichInline(cell))),
    },
    end: read.end,
  };
}

function readBlocks(lines: readonly string[], from: number): RichBlock[] {
  const index = lines.findIndex(
    (_, position) => position >= from && readBlockAt(lines, position) !== null,
  );

  const next = index === -1 ? null : readBlockAt(lines, index);

  if (!next) {
    return parseTextLines(lines.slice(from));
  }

  return [...parseTextLines(lines.slice(from, index)), next.block, ...readBlocks(lines, next.end)];
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
    case "code":
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
