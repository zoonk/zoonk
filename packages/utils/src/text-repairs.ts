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

/** A `>` before a number compares ("> 5 years"), so it stays. */
const HEADING_MARK = /^(?<indent>\s{0,3})#{1,6}\s+(?=\S)/u;
const QUOTE_MARK = /^(?<indent>\s*)>\s+(?=[^\d\s])/u;

const LINK = new RegExp(MARKDOWN_LINK.source, "gu");
const LINE_BREAK_TAG = /<br\s*\/?>/giu;

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
 * What code can't repair safely stays for a writer: a table where one line shows, rows with no
 * header, a code fence and other HTML.
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

function unmark({ line, segment }: { line: string; segment: InlineMarkupRange }): string {
  const written = line.slice(segment.start, segment.end);
  return segment.kind === "text" || /^(?:«|<<)/u.test(written) ? written : segment.text;
}

export function toPlainLine(text: string): string {
  const line = repairMarkdown({ layout: "inline", text }).replaceAll(LINE_BREAK, " ").trim();

  const plain = parseInlineMarkupRanges(line)
    .map((segment) => unmark({ line, segment }))
    .join("");

  return replaceEmDashes(plain).trim();
}
