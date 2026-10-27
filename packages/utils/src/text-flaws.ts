import { parseInlineMarkupRanges } from "./inline-markup";
import { isJsonObject } from "./json";
import { findMarkdownTableLines } from "./markdown-table";

/**
 * How a field shows its text: `blocks` keeps lines, lists and tables of data (a screen's body, a
 * question's context); `inline` shows one line, whatever its line breaks (an option, a title).
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

/** A link or a picture in Markdown: its text in brackets, then its URL. */
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

/** Math hidden behind spaces of its own length, so positions in the result point into the line. */
function hideMath(line: string): string {
  return line.replaceAll(MATH, (math) => " ".repeat(math.length));
}

/**
 * Where the emphasis marks parsing leaves as text are in one line (each mark's characters), after
 * a list mark and outside math, code, bold and italics: the marks learners would see.
 */
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

/** A row-like line ("| A | 49,8 |") outside a table the renderer reads. */
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

/** Whether a text has a table or a row of one, which a field that shows one line can't show. */
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
 * Markdown a learner would see as raw marks: the player renders emphasis, inline code, `$...$`
 * math, short lists and GFM tables of data in block text, and a single line of emphasis, code and
 * math in inline text; anything else (headings, links, HTML, quote marks, pipes outside a table,
 * emphasis split across lines or left unpaired) shows as written. One line per problem.
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

/** Every string in a text or a JSON value (an item, a screen), in order. */
function collectStrings(value: unknown): string[] {
  if (typeof value === "string") {
    return [value];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectStrings(entry));
  }

  return isJsonObject(value) ? Object.values(value).flatMap((entry) => collectStrings(entry)) : [];
}

/**
 * Em dashes in our own wording, which the app never shows (`replaceEmDashes` rewrites them before
 * learners see them): one line per text that has one, in a string or anywhere in a JSON value.
 * Quoted source text keeps its punctuation, so callers leave it out.
 */
export function findEmDashes(value: unknown): string[] {
  return collectStrings(value).flatMap((text) =>
    text.includes("—") ? [`Uses an em dash: ${quote(text)}. Write it without one.`] : [],
  );
}

export type WritingFlaw = { kind: "emDash" | "markdown" | "placeholder"; problem: string };

/**
 * What code finds wrong in a text learners read in our own words: an em dash, Markdown they'd see
 * as marks, or a slot or note a writer left unfinished.
 */
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

/** Only dots, dashes or marks: nothing a learner can read. */
const EMPTY = /^[\s.…\-–—_*?!]*$/u;

const PLACEHOLDERS: readonly RegExp[] = [
  /lorem ipsum/iu,
  /^\s*(?:TODO|TBD|FIXME)\b|\bXXX\b/u,
  /\{\{[^}]*\}\}/u,
  /\[\s*(?:insert|inserir|insira|adicione|add|preencher|preencha|fill in|placeholder|your|seu|sua|exemplo aqui|example here)\b[^\]]*\]/iu,
  /<\s*(?:insert|inserir|insira|placeholder|nome|name)\b[^>]*>/iu,
];

/**
 * Text a writer left unfinished: nothing to read, or a slot or note meant for someone to fill in
 * ("{{name}}", "[Insert example]", "TODO", "lorem ipsum"). An elision in a quote ("[...]") is
 * real text.
 */
export function findPlaceholderText(text: string): string[] {
  if (EMPTY.test(text)) {
    return ["The text is empty."];
  }

  return PLACEHOLDERS.flatMap((pattern) => {
    const match = pattern.exec(text);
    return match ? [`Has a placeholder a writer left: ${quote(match[0])}.`] : [];
  });
}
