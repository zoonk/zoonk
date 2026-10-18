import { type InlineMarkupRange, parseInlineMarkupRanges } from "./inline-markup";
import { findMarkdownTableLines } from "./markdown-table";
import { replaceEmDashes } from "./string";
import {
  MARKDOWN_LINK,
  type TextLayout,
  findStrayEmphasis,
  findUnrenderedMarkdown,
  hasTableRows,
} from "./text-flaws";

/** A heading's marks, and a quote's mark unless a number follows it ("> 5 years" compares). */
const HEADING_MARK = /^(?<indent>\s{0,3})#{1,6}\s+(?=\S)/u;
const QUOTE_MARK = /^(?<indent>\s*)>\s+(?=[^\d\s])/u;

const LINK = new RegExp(MARKDOWN_LINK.source, "gu");
const LINE_BREAK_TAG = /<br\s*\/?>/giu;

/** Tags that only style or wrap their words, so the words stay when the tags go. */
const STYLE_TAG = /<\/?(?:a|b|div|em|i|p|small|span|strong|u)\b[^>]*>/giu;

const LINE_BREAK = /\s*\n\s*/gu;

function removeStrayEmphasis(line: string): string {
  const stray = findStrayEmphasis(line);

  return stray.size === 0
    ? line
    : line
        .split("")
        .filter((_, index) => !stray.has(index))
        .join("");
}

function removeLineMarks(line: string): string {
  return line.replace(HEADING_MARK, "$<indent>").replace(QUOTE_MARK, "$<indent>");
}

/** A link's text without its brackets and URL, HTML tags out and emphasis marks nobody can pair. */
function removeInlineMarks({ breakAs, line }: { breakAs: string; line: string }): string {
  return line
    .replaceAll(LINK, "$<text>")
    .replaceAll(LINE_BREAK_TAG, breakAs)
    .replaceAll(STYLE_TAG, "")
    .split("\n")
    .map((part) => removeStrayEmphasis(part))
    .join("\n");
}

function repairBlocks(text: string): string {
  const lines = text.split("\n");
  const tableLines = findMarkdownTableLines(lines);

  return lines
    .map((line, index) =>
      tableLines.has(index)
        ? line
            .split("|")
            .map((cell) => removeInlineMarks({ breakAs: " ", line: cell }))
            .join("|")
        : removeInlineMarks({ breakAs: "\n", line: removeLineMarks(line) }),
    )
    .join("\n");
}

function repairInline(text: string): string {
  const line = text
    .split("\n")
    .map((part) => removeLineMarks(part))
    .join("\n")
    .replaceAll(LINE_BREAK, " ");

  return removeInlineMarks({ breakAs: " ", line });
}

/**
 * Takes out the Markdown a learner would see as marks (`findUnrenderedMarkdown`), keeping the
 * words: a heading's and a quote's marks, a link's brackets and URL, HTML tags that only style
 * text (a line break tag becomes one), and emphasis marks the app can't pair, such as italics split
 * across lines. A field that shows one line loses its line breaks, which it never showed. What
 * code can't repair safely stays for a writer: a table where one line shows, rows with no header,
 * a code fence and other HTML. Text with nothing to repair comes back as it was.
 */
export function repairMarkdown({ layout, text }: { layout: TextLayout; text: string }): string {
  if (findUnrenderedMarkdown({ layout, text }).length === 0) {
    return text;
  }

  if (layout === "blocks") {
    return repairBlocks(text);
  }

  return hasTableRows(text) ? text : repairInline(text);
}

/** A segment's words: bold, italics and code lose their marks; quoted words keep their quotes. */
function unmark({ line, segment }: { line: string; segment: InlineMarkupRange }): string {
  const written = line.slice(segment.start, segment.end);
  return segment.kind === "text" || /^(?:«|<<)/u.test(written) ? written : segment.text;
}

/**
 * A text shown as one plain line, such as a title, a skill's name or an outline's description: no
 * em dashes, no line breaks and no Markdown, so marked words read as the words they mark.
 */
export function toPlainLine(text: string): string {
  const line = repairMarkdown({ layout: "inline", text }).replaceAll(LINE_BREAK, " ").trim();

  const plain = parseInlineMarkupRanges(line)
    .map((segment) => unmark({ line, segment }))
    .join("");

  return replaceEmDashes(plain).trim();
}
