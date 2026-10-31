"use client";

import { type RichInlineSegment, RichInlineSegments } from "@zoonk/learn/rich-text/inline";
import { parseInlineMarkup } from "@zoonk/utils/inline-markup";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";

const MATH_DELIMITERS = [
  { close: "\\\\)", kind: "math" as const, open: "\\\\(" },
  { close: "\\\\]", kind: "displayMath" as const, open: "\\\\[" },
  { close: "\\)", kind: "math" as const, open: "\\(" },
  { close: "\\]", kind: "displayMath" as const, open: "\\[" },
];

function findNextMathDelimiter(text: string) {
  const matches = MATH_DELIMITERS.map((delimiter) => ({
    ...delimiter,
    index: text.indexOf(delimiter.open),
  })).filter((match) => match.index >= 0);

  return matches.toSorted((first, second) => first.index - second.index)[0] ?? null;
}

function parseMathSegments(text: string): RichInlineSegment[] {
  const delimiter = findNextMathDelimiter(text);

  if (!delimiter) {
    return parseInlineMarkup(text);
  }

  const before = text.slice(0, delimiter.index);
  const mathStart = delimiter.index + delimiter.open.length;
  const mathEnd = text.indexOf(delimiter.close, mathStart);

  if (mathEnd === -1) {
    return parseInlineMarkup(text);
  }

  const mathText = text.slice(mathStart, mathEnd);
  const after = text.slice(mathEnd + delimiter.close.length);

  return [
    ...parseInlineMarkup(before),
    { kind: delimiter.kind, text: mathText },
    ...parseMathSegments(after),
  ];
}

export function PlayerRichText({ text }: { text: string }) {
  return <RichInlineSegments segments={parseMathSegments(stripWrappingQuotes(text))} />;
}
