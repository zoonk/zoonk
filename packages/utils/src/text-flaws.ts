import { parseInlineMarkupRanges } from "./inline-markup";
import { isJsonObject } from "./json";
import { findMarkdownTableLines } from "./markdown-table";

/**
 * `blocks` keeps lines, lists and tables (a screen's body); `inline` shows one line, whatever its
 * line breaks (an option, a title).
 */
export type TextLayout = "blocks" | "inline";

/** Math the renderers draw with KaTeX: its `_` and `*` are LaTeX, never emphasis. */
const MATH = /\$\$[\s\S]*?\$\$|\$[^$\n]+\$|\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]/gu;

const LIST_MARK = /^\s*(?:[-*•]|\d{1,3}[.)])\s+/u;

const BLOCK_MARKS: readonly { pattern: RegExp; problem: string }[] = [
  { pattern: /^\s{0,3}#{1,6}\s+\S/u, problem: "a heading's # marks" },
  { pattern: /^\s*>\s/u, problem: "a quote's > mark" },
  { pattern: /^\s*```/u, problem: "a code fence" },
];

export const MARKDOWN_LINK = /!?\[(?<text>[^\]\n]+)\]\([^)\s]+\)/u;

const INLINE_MARKS: readonly { pattern: RegExp; problem: string }[] = [
  { pattern: MARKDOWN_LINK, problem: "a link's brackets and URL" },
  {
    pattern:
      /<\/?(?:a|b|br|code|div|em|h[1-6]|hr|i|img|li|ol|p|pre|small|span|strong|sub|sup|table|td|th|tr|u|ul)\b[^>]*>/iu,
    problem: "an HTML tag",
  },
];

/**
 * Emphasis marks parsing left as text: a `**` with no partner, a `_` opening or closing a word
 * (snake_case and fill-in blanks like "___" stay text), and two or more `*` touching words (one is
 * a footnote mark, "2 * 3" is multiplication).
 */
const BOLD_MARK = /\*\*|(?<!_)__(?!_)/gu;

const UNDERSCORE_MARK =
  /(?<![\p{L}\p{N}_])_(?=[\p{L}\p{N}])|(?<=[\p{L}\p{N}.!?,;:])_(?![\p{L}\p{N}_])/gu;

const STAR_MARK = /(?<=\S)\*(?!\*)|(?<!\*)\*(?=\S)/gu;

function quote(text: string): string {
  return `"${text.trim()}"`;
}

/** Spaces of the math's own length keep positions in the result pointing into the line. */
function hideMath(line: string): string {
  return line.replaceAll(MATH, (math) => " ".repeat(math.length));
}

export function findStrayEmphasis(line: string): Set<number> {
  const list = LIST_MARK.exec(line)?.[0].length ?? 0;
  const hidden = hideMath(line);

  const segments = parseInlineMarkupRanges(hidden.slice(list)).flatMap(({ kind, start, text }) =>
    kind === "text" ? [{ start: list + start, text }] : [],
  );

  const at = (pattern: RegExp) =>
    segments.flatMap(({ start, text }) =>
      [...text.matchAll(pattern)].flatMap((match) =>
        Array.from({ length: match[0].length }, (_, offset) => start + match.index + offset),
      ),
    );

  const stars = at(STAR_MARK);

  return new Set([...at(BOLD_MARK), ...at(UNDERSCORE_MARK), ...(stars.length >= 2 ? stars : [])]);
}

function findMarks(line: string, marks: typeof INLINE_MARKS): string[] {
  return marks.flatMap(({ pattern, problem }) =>
    pattern.test(line) ? [`Shows ${problem} as text: ${quote(line)}.`] : [],
  );
}

function findLineProblems(line: string): string[] {
  return [
    ...findMarks(line, INLINE_MARKS),
    ...(findStrayEmphasis(line).size > 0
      ? [`Shows emphasis marks the app can't pair, so learners see them: ${quote(line)}.`]
      : []),
  ];
}

function isStrayRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("|") && (trimmed.match(/\|/gu)?.length ?? 0) >= 2;
}

function findBlockProblems(text: string): string[] {
  const lines = text.split(/\r?\n/u);
  const tableLines = findMarkdownTableLines(lines);

  return lines.flatMap((line, index) => {
    if (tableLines.has(index)) {
      return line.split("|").flatMap((cell) => findLineProblems(cell));
    }

    return [
      ...findMarks(line, BLOCK_MARKS),
      ...(isStrayRow(line)
        ? [
            `Shows table pipes as text, since the rows have no header and |---| line: ${quote(line)}.`,
          ]
        : []),
      ...findLineProblems(line),
    ];
  });
}

export function hasTableRows(text: string): boolean {
  const lines = text.split(/\r?\n/u);
  return findMarkdownTableLines(lines).size > 0 || lines.some((line) => isStrayRow(line));
}

function findInlineProblems(text: string): string[] {
  const lines = text.split(/\r?\n/u);

  return [
    ...(hasTableRows(text)
      ? ["Has a table where only one line of text shows; put the data in the context."]
      : []),
    ...lines.flatMap((line) => findMarks(line, BLOCK_MARKS)),
    ...findLineProblems(text.replaceAll(/\s*\n\s*/gu, " ")),
  ];
}

/**
 * Must match what the player renders: emphasis, inline code, `$...$` math, short lists and GFM
 * tables in block text, and one line of emphasis, code and math in inline text.
 */
export function findUnrenderedMarkdown({
  layout,
  text,
}: {
  layout: TextLayout;
  text: string;
}): string[] {
  return layout === "blocks" ? findBlockProblems(text) : findInlineProblems(text);
}

function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }

  return isJsonObject(value) ? Object.values(value).flatMap((entry) => collectStrings(entry)) : [];
}

/** Quoted source text keeps its punctuation, so callers leave it out. */
export function findEmDashes(value: unknown): string[] {
  return collectStrings(value).flatMap((text) =>
    text.includes("—") ? [`Uses an em dash: ${quote(text)}. Write it without one.`] : [],
  );
}

export type WritingFlaw = { kind: "emDash" | "markdown" | "placeholder"; problem: string };

export function findWritingFlaws({
  layout,
  text,
}: {
  layout: TextLayout;
  text: string;
}): WritingFlaw[] {
  return [
    ...findEmDashes(text).map((problem) => ({ kind: "emDash" as const, problem })),
    ...findUnrenderedMarkdown({ layout, text }).map((problem) => ({
      kind: "markdown" as const,
      problem,
    })),
    ...findPlaceholderText(text).map((problem) => ({ kind: "placeholder" as const, problem })),
  ];
}

const EMPTY = /^[\s.…\-–—_*?!]*$/u;

const PLACEHOLDERS: readonly RegExp[] = [
  /lorem ipsum/iu,
  /^\s*(?:TODO|TBD|FIXME)\b|\bXXX\b/u,
  /\{\{[^}]*\}\}/u,
  /\[\s*(?:insert|inserir|insira|adicione|add|preencher|preencha|fill in|placeholder|your|seu|sua|exemplo aqui|example here)\b[^\]]*\]/iu,
  /<\s*(?:insert|inserir|insira|placeholder|nome|name)\b[^>]*>/iu,
];

/** An elision in a quote ("[...]") is real text. */
export function findPlaceholderText(text: string): string[] {
  if (EMPTY.test(text)) {
    return ["The text is empty."];
  }

  return PLACEHOLDERS.flatMap((pattern) => {
    const match = pattern.exec(text);
    return match ? [`Has a placeholder a writer left: ${quote(match[0])}.`] : [];
  });
}
