"use client";

import { renderToString } from "katex";
import { useReplaceName } from "../user-name-context";
import { stripWrappingQuotes } from "./_utils/strip-wrapping-quotes";

type RichTextSegment =
  | { kind: "bold"; text: string }
  | { kind: "code"; text: string }
  | { kind: "displayMath"; text: string }
  | { kind: "italic"; text: string }
  | { kind: "math"; text: string }
  | { kind: "text"; text: string };

const MATH_DELIMITERS = [
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
function parseMathSegments(text: string): RichTextSegment[] {
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
function parseCodeSegments(text: string): RichTextSegment[] {
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
function parseEmphasisSegments(text: string): RichTextSegment[] {
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
}): RichTextSegment[] {
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
 * Renders LaTeX through KaTeX with errors kept inline. AI-generated formulas
 * should never crash the player, and visible fallback text makes bad formulas
 * reviewable instead of invisible.
 */
function renderMathToHtml({ displayMode, text }: { displayMode: boolean; text: string }) {
  return renderToString(text, { displayMode, output: "mathml", throwOnError: false, trust: false });
}

/**
 * Renders generated lesson copy with only the formatting primitives we support
 * in player content: LaTeX math, inline code, and simple bold/italic emphasis.
 */
export function PlayerRichText({ text }: { text: string }) {
  const replaceName = useReplaceName();
  const displayText = stripWrappingQuotes(replaceName(text));

  return parseMathSegments(displayText).map((segment, index) => {
    const key = `${segment.kind}-${index}`;

    if (segment.kind === "bold") {
      return <strong key={key}>{segment.text}</strong>;
    }

    if (segment.kind === "italic") {
      return <em key={key}>{segment.text}</em>;
    }

    if (segment.kind === "code") {
      return (
        <code
          className="bg-muted text-foreground rounded-sm px-1 py-0.5 font-mono text-[0.85em]"
          key={key}
        >
          {segment.text}
        </code>
      );
    }

    if (segment.kind === "math" || segment.kind === "displayMath") {
      return (
        <span
          className={segment.kind === "displayMath" ? "my-3 block overflow-x-auto" : undefined}
          // eslint-disable-next-line react/no-danger -- KaTeX returns escaped MathML with trust disabled, which lets formulas render without allowing AI-provided HTML.
          dangerouslySetInnerHTML={{
            __html: renderMathToHtml({
              displayMode: segment.kind === "displayMath",
              text: segment.text,
            }),
          }}
          key={key}
        />
      );
    }

    return <span key={key}>{segment.text}</span>;
  });
}
