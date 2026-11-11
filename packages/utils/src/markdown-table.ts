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

type FoundTable = { end: number; start: number; table: MarkdownTable };

/** Like the players: after a table, the search carries on from its last row, so a body row is never read as a new header. */
function readMarkdownTables(lines: readonly string[]): FoundTable[] {
  return lines.reduce<FoundTable[]>((found, _, index) => {
    if (index < (found.at(-1)?.end ?? 0)) {
      return found;
    }

    const read = readMarkdownTable(lines, index);

    if (read) {
      found.push({ ...read, start: index });
    }

    return found;
  }, []);
}

export function findMarkdownTables(text: string): MarkdownTable[] {
  return readMarkdownTables(text.split(/\r?\n/u)).map(({ table }) => table);
}

export function findRaggedTableRows(text: string): string[] {
  const lines = text.split(/\r?\n/u);

  return readMarkdownTables(lines).flatMap(({ end, start, table }) =>
    lines.slice(start + 2, end).filter((row) => splitRow(row).length !== table.align.length),
  );
}

export function findMarkdownTableLines(lines: readonly string[]): ReadonlySet<number> {
  return new Set(
    readMarkdownTables(lines).flatMap(({ end, start }) =>
      Array.from({ length: end - start }, (_, offset) => start + offset),
    ),
  );
}

export function splitTableCells(line: string): string[] {
  return line.split(CELL_PIPE);
}

/** The player reads each line, and each table cell, on its own; joining with `|` and `\n` restores the text. */
export function splitLinesAndCells(text: string): string[][] {
  const lines = text.split("\n");
  const tableLines = findMarkdownTableLines(lines);

  return lines.map((line, index) => (tableLines.has(index) ? splitTableCells(line) : [line]));
}

export function removeMarkdownTables(text: string): string {
  const lines = text.split(/\r?\n/u);
  const tableLines = findMarkdownTableLines(lines);

  return lines.filter((_, index) => !tableLines.has(index)).join("\n");
}
