import { type Formula } from "./math-key";
import { type RichInlineSegment } from "./rich-inline-segments";
import { parseRichBlocks, parseRichInline, toOneLine } from "./rich-text-parser";

function toFormulas(segments: readonly RichInlineSegment[]): Formula[] {
  return segments.flatMap((segment) =>
    segment.kind === "math" || segment.kind === "displayMath"
      ? [{ displayMode: segment.kind === "displayMath", text: segment.text }]
      : [],
  );
}

function formulasIn(text: string): Formula[] {
  const blocks = parseRichBlocks(text).flatMap((block) => {
    switch (block.kind) {
      case "list":
        return block.items.flat();
      case "paragraph":
        return block.lines.flat();
      case "table":
        return [...block.header.flat(), ...block.rows.flatMap((row) => row.flat())];
      default:
        return block satisfies never;
    }
  });

  return [
    ...toFormulas(parseRichInline(toOneLine(text))),
    ...toFormulas(parseRichInline(text)),
    ...toFormulas(blocks),
  ];
}

export function collectFormulas(value: unknown, key: string | null = null): Formula[] {
  if (typeof value === "string") {
    return key === "math" ? [{ displayMode: true, text: value }] : formulasIn(value);
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => collectFormulas(item));
  }

  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([field, item]) => collectFormulas(item, field));
  }

  return [];
}
