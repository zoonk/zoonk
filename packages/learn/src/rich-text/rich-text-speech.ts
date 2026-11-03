import { type MathWords, speakMath } from "./math-speech";
import { type RichInlineSegment } from "./rich-inline-segments";
import { type RichBlock, parseRichBlocks, parseRichInline, toOneLine } from "./rich-text-parser";

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

/** A table is its own region with its own label, so a label or announcement leaves it out. */
function spokenLines(block: RichBlock): RichInlineSegment[][] {
  switch (block.kind) {
    case "list":
      return block.items;
    case "paragraph":
      return block.lines;
    case "table":
      return [];
    default:
      return block satisfies never;
  }
}

export function speakRichBlocks({ text, words }: { text: string; words: MathWords }): string {
  return parseRichBlocks(text)
    .flatMap((block) => spokenLines(block))
    .map((segments) => speakSegments({ segments, words }))
    .join(" ");
}
