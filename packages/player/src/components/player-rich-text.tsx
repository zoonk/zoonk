"use client";

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
 * markers never modify LaTeX commands such as \lambda or \theta.
 */
function parseMathSegments(text: string): RichInlineSegment[] {
  const delimiter = findNextMathDelimiter(text);

  if (!delimiter) {
    return parseCodeSegments(text);
  }

  const before = text.slice(0, delimiter.index);
  const mathStart = delimiter.index + delimiter.open.length;
  const mathEnd = text.indexOf(delimiter.close, mathStart);

  if (mathEnd === -1) {
    return parseCodeSegments(text);
  }

  const mathText = text.slice(mathStart, mathEnd);
  const after = text.slice(mathEnd + delimiter.close.length);

  return [
    ...parseCodeSegments(before),
    { kind: delimiter.kind, text: mathText },
    ...parseMathSegments(after),
  ];
}

/**
 * Parses inline code before emphasis so generated examples such as
 * `greetUser();` keep their literal punctuation instead of being interpreted
 * as lightweight Markdown.
 */
function parseCodeSegments(text: string): RichInlineSegment[] {
  const start = text.indexOf("`");
  const contentStart = start + 1;
  const end = text.indexOf("`", contentStart);

  if (start === -1 || end === -1) {
    return parseEmphasisSegments(text);
  }

  const before = text.slice(0, start);
  const content = text.slice(contentStart, end);
  const after = text.slice(end + 1);

  return [
    ...parseEmphasisSegments(before),
    { kind: "code", text: content },
    ...parseCodeSegments(after),
  ];
}

/**
 * Parses the small text emphasis subset that AI lesson copy actually uses.
 * This intentionally avoids a broad Markdown renderer so generated headings,
 * lists, tables, or links cannot unexpectedly change the player layout.
 */
function parseEmphasisSegments(text: string): RichInlineSegment[] {
  const boldStart = text.indexOf("**");
  const italicStart = text.indexOf("*");
  const hasBold = boldStart !== -1;
  const hasItalic = italicStart !== -1;

  if (!hasBold && !hasItalic) {
    return text ? [{ kind: "text", text }] : [];
  }

  if (hasBold && (!hasItalic || boldStart <= italicStart)) {
    return parseMarkedSegment({ close: "**", kind: "bold", open: "**", text });
  }

  return parseMarkedSegment({ close: "*", kind: "italic", open: "*", text });
}

/**
 * Converts one matched emphasis pair and then recursively parses the text
 * around it. Unmatched markers stay visible because showing the original
 * generated text is better than dropping learner-facing content.
 */
function parseMarkedSegment({
  close,
  kind,
  open,
  text,
}: {
  close: string;
  kind: "bold" | "italic";
  open: string;
  text: string;
}): RichInlineSegment[] {
  const start = text.indexOf(open);
  const contentStart = start + open.length;
  const end = text.indexOf(close, contentStart);

  if (start === -1 || end === -1) {
    return text ? [{ kind: "text", text }] : [];
  }

  const before = text.slice(0, start);
  const content = text.slice(contentStart, end);
  const after = text.slice(end + close.length);

  return [
    ...parseEmphasisSegments(before),
    { kind, text: content },
    ...parseEmphasisSegments(after),
  ];
}

/**
 * Renders generated lesson copy with only the formatting primitives we support
 * in player content: LaTeX math, inline code, and simple bold/italic emphasis.
 */
export function PlayerRichText({ text }: { text: string }) {
  const replaceName = useReplaceName();
  const displayText = stripWrappingQuotes(replaceName(text));

  return <RichInlineSegments segments={parseMathSegments(displayText)} />;
}
