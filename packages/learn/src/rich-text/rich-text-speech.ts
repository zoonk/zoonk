import { toOneLine } from "@zoonk/utils/math-spans";
import { speakMath } from "./math-speech";
import { type MathWords } from "./math-words";
import { type RichInlineSegment } from "./rich-inline-segments";
import { type RichBlock, parseRichBlocks, parseRichInline } from "./rich-text-parser";

const ENDS_IN_PUNCTUATION = /\p{P}$/u;

export function speakSegments({
  segments,
  words,
}: {
  segments: readonly RichInlineSegment[];
  words: MathWords;
}): string {
  return segments
    .map((segment) =>
      segment.kind === "math" || segment.kind === "displayMath"
        ? speakMath({ latex: segment.text, words })
        : segment.text,
    )
    .join("");
}

export function speakRichInline({ text, words }: { text: string; words: MathWords }): string {
  return speakSegments({ segments: parseRichInline(toOneLine(text)), words });
}

function numbered(items: RichInlineSegment[][]): RichInlineSegment[][] {
  return items.map((item, index) => [{ kind: "text", text: `${index + 1}. ` }, ...item]);
}

/** A table is its own region with its own label, so a label or announcement leaves it out. */
function spokenLines(block: RichBlock): RichInlineSegment[][] {
  switch (block.kind) {
    case "list":
      return block.ordered ? numbered(block.items) : block.items;
    case "paragraph":
      return block.lines;
    case "table":
      return [];
    default:
      return block satisfies never;
  }
}

function tableHeader(block: RichBlock): RichInlineSegment[][] {
  return block.kind === "table" ? block.header : [];
}

/** A line that ends without punctuation gets a comma, so a screen reader pauses between lines. */
function joinLines(lines: readonly string[]): string {
  return lines
    .map((line, index) =>
      index < lines.length - 1 && !ENDS_IN_PUNCTUATION.test(line) ? `${line},` : line,
    )
    .join(" ");
}

export function speakRichBlocks({ text, words }: { text: string; words: MathWords }): string {
  const blocks = parseRichBlocks(text);
  const lines = blocks.flatMap((block) => spokenLines(block));
  const spokenText = lines.length > 0 ? lines : blocks.flatMap((block) => tableHeader(block));

  return joinLines(
    spokenText.map((segments) => speakSegments({ segments, words }).trim()).filter(Boolean),
  );
}
