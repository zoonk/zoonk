import { editProse, findCodeFenceLines, findCodeFences } from "./code-fence";
import { type InlineMarkupRange, parseInlineMarkupRanges } from "./inline-markup";
import { findMarkdownTableLines, splitTableCells } from "./markdown-table";
import { splitAtMath } from "./math-spans";
import { replaceEmDashes } from "./string";
import {
  AUTOLINK,
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
const ANGLE_LINK = new RegExp(AUTOLINK.source, "giu");

const LINE_BREAK = /\s*\n\s*/gu;

/** Taking out a mark can leave its neighbor stray ("_**a" leaves "_a"), so it repeats until none is. */
function removeStrayEmphasis(line: string): string {
  const stray = findStrayEmphasis(line);

  return stray.size === 0
    ? line
    : removeStrayEmphasis(
        line
          .split("")
          .filter((_, index) => !stray.has(index))
          .join(""),
      );
}

function removeLineMarks(line: string): string {
  return line.replace(HEADING_MARK, "$<indent>").replace(QUOTE_MARK, "$<indent>");
}

const PLACEHOLDER = /\u{E000}(?<index>\d+)\u{E001}/gu;

/** Each formula stands in as a placeholder, so an edit sees a link around it whole. */
function editOutsideMath(line: string, edit: (text: string) => string): string {
  const segments = splitAtMath(line);
  const formulas = segments.filter(({ kind }) => kind !== "text");

  const masked = segments
    .map((segment) =>
      segment.kind === "text" ? segment.text : `\u{E000}${formulas.indexOf(segment)}\u{E001}`,
    )
    .join("");

  return edit(masked).replaceAll(PLACEHOLDER, (placeholder, index: string) => {
    const formula = formulas[Number(index)];
    return formula ? line.slice(formula.start, formula.end) : placeholder;
  });
}

/** Emphasis pairs with its inline code in view, since players never pair it across code. */
function removeInlineMarks(line: string): string {
  return editProse(line, (prose) =>
    editOutsideMath(prose, (text) =>
      text.replaceAll(LINK, "$<text>").replaceAll(ANGLE_LINK, "$<address>"),
    ),
  )
    .split("\n")
    .map((part) => removeStrayEmphasis(part))
    .join("\n");
}

function repairLine({
  code,
  index,
  line,
  tableLines,
}: {
  code: ReadonlySet<number>;
  index: number;
  line: string;
  tableLines: ReadonlySet<number>;
}): string {
  if (code.has(index)) {
    return line;
  }

  return tableLines.has(index)
    ? splitTableCells(line)
        .map((cell) => removeInlineMarks(cell))
        .join("|")
    : removeInlineMarks(removeLineMarks(line));
}

function repairBlocks(text: string): string {
  const lines = text.split("\n");
  const code = findCodeFenceLines(lines);
  const tableLines = findMarkdownTableLines(lines);

  return lines.map((line, index) => repairLine({ code, index, line, tableLines })).join("\n");
}

function repairInline(text: string): string {
  const line = text
    .split("\n")
    .map((part) => removeLineMarks(part))
    .join("\n")
    .replaceAll(LINE_BREAK, " ");

  return removeInlineMarks(line);
}

function hasCodeBlock(text: string): boolean {
  return findCodeFences(text.split(/\r?\n/u)).length > 0;
}

/**
 * Code keeps every character: a `#` comment, `**kwargs` and `<div>` are code, never marks. What
 * code can't repair safely stays for a writer: a table or a code block where one line shows, rows
 * with no header, a code fence that never closed, and HTML, since a tag can be what a lesson teaches.
 */
export function repairMarkdown({ layout, text }: { layout: TextLayout; text: string }): string {
  if (findUnrenderedMarkdown({ layout, text }).length === 0) {
    return text;
  }

  if (layout === "blocks") {
    return repairBlocks(text);
  }

  return hasTableRows(text) || hasCodeBlock(text) ? text : repairInline(text);
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
