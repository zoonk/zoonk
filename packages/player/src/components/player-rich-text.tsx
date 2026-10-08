"use client";

import { parseInlineMarkup } from "@zoonk/utils/inline-markup";
import { useReplaceName } from "../user-name-context";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";
import { type RichInlineSegment, RichInlineSegments } from "./rich-inline-segments";

const MATH_DELIMITERS = [
  { close: "\\\\)", kind: "math" as const, open: "\\\\(" },
  { close: "\\\\]", kind: "displayMath" as const, open: "\\\\[" },
  { close: "\\)", kind: "math" as const, open: "\\(" },
  { close: "\\]", kind: "displayMath" as const, open: "\\[" },
];

/**
 * Finds the next LaTeX delimiter because generated lessons commonly use
 * standard inline math markers inside otherwise plain prose. The player only
 * needs to recognize those markers, not the full Markdown grammar.
 */
function findNextMathDelimiter(text: string) {
  const matches = MATH_DELIMITERS.map((delimiter) => ({
    ...delimiter,
    index: text.indexOf(delimiter.open),
  })).filter((match) => match.index >= 0);

  return matches.toSorted((first, second) => first.index - second.index)[0] ?? null;
}

/**
 * Splits lesson prose into math and non-math regions so lightweight Markdown
 * markers never modify LaTeX commands such as \lambda or \theta. Outside math,
 * code and emphasis (angle-quoted words included) read the way every learner
 * text reads them.
 */
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

/**
 * Renders generated lesson copy with only the formatting primitives we support
 * in player content: LaTeX math, inline code, and bold/italic emphasis.
 */
export function PlayerRichText({ text }: { text: string }) {
  const replaceName = useReplaceName();
  const displayText = stripWrappingQuotes(replaceName(text));

  return <RichInlineSegments segments={parseMathSegments(displayText)} />;
}
