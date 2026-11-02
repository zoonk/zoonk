/** Cells stay raw text, so each renderer parses its own inline markup in them. */
export type MarkdownTableAlign = "center" | "left" | "right" | null;

export type MarkdownTable = { align: MarkdownTableAlign[]; header: string[]; rows: string[][] };

const DELIMITER_CELL = /^:?-+:?$/u;
const EDGE_PIPES = /^\||(?<!\\)\|$/gu;
const CELL_PIPE = /(?<!\\)\|/u;
const ESCAPED_PIPE = String.raw`\|`;

function isRow(line: string | undefined): line is string {
  return line?.includes("|") ?? false;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replaceAll(EDGE_PIPES, "")
    .split(CELL_PIPE)
    .map((cell) => cell.trim().replaceAll(ESCAPED_PIPE, "|"));
}

function toAlign(cell: string): MarkdownTableAlign {
  const left = cell.startsWith(":");
  const right = cell.endsWith(":");

  if (left && right) {
    return "center";
  }

  if (right) {
    return "right";
  }

  return left ? "left" : null;
}

function readDelimiter(line: string | undefined): MarkdownTableAlign[] | null {
  if (!isRow(line)) {
    return null;
  }

  const cells = splitRow(line);

  return cells.every((cell) => DELIMITER_CELL.test(cell))
    ? cells.map((cell) => toAlign(cell))
    : null;
}

function readTableStart(lines: readonly string[], index: number): MarkdownTableAlign[] | null {
  const header = lines[index];
  const align = readDelimiter(lines[index + 1]);

  return isRow(header) && align && splitRow(header).length === align.length ? align : null;
}

/**
 * Where a table's rows stop: at a blank line or a line without a pipe. GFM would keep a sentence
 * written right under a table as one more row; writers mean it as text.
 */
function findRowsEnd(lines: readonly string[], index: number): number {
  return isRow(lines[index]) ? findRowsEnd(lines, index + 1) : index;
}

function toCells(line: string, count: number): string[] {
  const cells = splitRow(line);
  return Array.from({ length: count }, (_, index) => cells[index] ?? "");
}

export function isMarkdownTableStart(lines: readonly string[], index: number): boolean {
  return readTableStart(lines, index) !== null;
}

/** `end` is the line after the table's last row. */
export function readMarkdownTable(
  lines: readonly string[],
  index: number,
): { end: number; table: MarkdownTable } | null {
  const align = readTableStart(lines, index);

  if (!align) {
    return null;
  }

  const end = findRowsEnd(lines, index + 2);

  return {
    end,
    table: {
      align,
      header: toCells(lines[index] ?? "", align.length),
      rows: lines.slice(index + 2, end).map((line) => toCells(line, align.length)),
    },
  };
}

export function findMarkdownTables(text: string): MarkdownTable[] {
  const lines = text.split(/\r?\n/u);

  return lines.flatMap((_, index) => {
    const read = isRow(lines[index - 1]) ? null : readMarkdownTable(lines, index);
    return read ? [read.table] : [];
  });
}

export function findRaggedTableRows(text: string): string[] {
  const lines = text.split(/\r?\n/u);

  return lines.flatMap((_, index) => {
    const read = isRow(lines[index - 1]) ? null : readMarkdownTable(lines, index);

    if (!read) {
      return [];
    }

    const count = read.table.align.length;
    return lines.slice(index + 2, read.end).filter((row) => splitRow(row).length !== count);
  });
}

export function findMarkdownTableLines(lines: readonly string[]): ReadonlySet<number> {
  return new Set(
    lines.flatMap((_, index) => {
      const read = isRow(lines[index - 1]) ? null : readMarkdownTable(lines, index);
      return read ? Array.from({ length: read.end - index }, (__, offset) => index + offset) : [];
    }),
  );
}

export function removeMarkdownTables(text: string): string {
  const lines = text.split(/\r?\n/u);
  const tableLines = findMarkdownTableLines(lines);

  return lines.filter((_, index) => !tableLines.has(index)).join("\n");
}
