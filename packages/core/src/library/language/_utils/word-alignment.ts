/**
 * One step of a word-level alignment between what was expected and what was
 * heard: a word heard as expected, heard as another word, not heard, or an
 * extra word nobody asked for.
 */
export type AlignmentStep =
  | { kind: "match"; expected: number }
  | { kind: "substitute"; expected: number; heard: number }
  | { kind: "delete"; expected: number }
  | { kind: "insert"; heard: number };

const MIN_SUBSTITUTION_COST = 0.5;
const EPSILON = 1e-9;
const graphemes = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/** Letters as a reader sees them, so an accented letter counts as one. */
function toGraphemes(text: string): string[] {
  return Array.from(graphemes.segment(text), (segment) => segment.segment);
}

/** Costs add up the same way both times they are computed, but compare with a margin anyway. */
function isStep(from: number, cost: number, to: number): boolean {
  return Math.abs(from - (to + cost)) < EPSILON;
}

function getCharacterDistance(from: readonly string[], to: readonly string[]): number {
  const rows = Array.from({ length: from.length + 1 }, (_, row) =>
    Array.from({ length: to.length + 1 }, (__, column) => (row === 0 ? column : row)),
  );

  for (let row = 1; row <= from.length; row += 1) {
    for (let column = 1; column <= to.length; column += 1) {
      const cells = rows[row];

      if (cells) {
        cells[column] = Math.min(
          (rows[row - 1]?.[column - 1] ?? 0) + (from[row - 1] === to[column - 1] ? 0 : 1),
          (rows[row - 1]?.[column] ?? 0) + 1,
          (cells[column - 1] ?? 0) + 1,
        );
      }
    }
  }

  return rows[from.length]?.[to.length] ?? Math.max(from.length, to.length);
}

/**
 * Replacing a word costs less the more it sounds and looks like the word
 * heard, so "two" pairs with "tree" rather than with a neighbouring "big".
 * It never drops below half, so a replacement still beats a miss plus an
 * extra word.
 */
function getSubstitutionCost(expected: string, heard: string): number {
  if (expected === heard) {
    return 0;
  }

  const from = toGraphemes(expected);
  const to = toGraphemes(heard);
  const distance = getCharacterDistance(from, to) / Math.max(from.length, to.length);

  return MIN_SUBSTITUTION_COST + (1 - MIN_SUBSTITUTION_COST) * distance;
}

function buildCostTable(expected: readonly string[], heard: readonly string[]): number[][] {
  const table = Array.from({ length: expected.length + 1 }, (_, row) =>
    Array.from({ length: heard.length + 1 }, (__, column) => (row === 0 ? column : row)),
  );

  for (let row = 1; row <= expected.length; row += 1) {
    for (let column = 1; column <= heard.length; column += 1) {
      const cells = table[row];
      const cost = getSubstitutionCost(expected[row - 1] ?? "", heard[column - 1] ?? "");

      if (cells) {
        cells[column] = Math.min(
          (table[row - 1]?.[column - 1] ?? 0) + cost,
          (table[row - 1]?.[column] ?? 0) + 1,
          (cells[column - 1] ?? 0) + 1,
        );
      }
    }
  }

  return table;
}

/**
 * Aligns expected words with heard words by weighted edit distance, read back
 * from the end. Ties prefer a match, then a replacement, then a missed word,
 * so "hent" lines up with "rent" instead of counting as one missed word and
 * one extra.
 */
export function alignWords(expected: readonly string[], heard: readonly string[]): AlignmentStep[] {
  const table = buildCostTable(expected, heard);
  const cell = (row: number, column: number) => table[row]?.[column] ?? Number.POSITIVE_INFINITY;

  function walk(row: number, column: number, steps: AlignmentStep[]): AlignmentStep[] {
    if (row === 0 && column === 0) {
      return steps;
    }

    const current = cell(row, column);

    if (row > 0 && column > 0) {
      const cost = getSubstitutionCost(expected[row - 1] ?? "", heard[column - 1] ?? "");

      if (isStep(current, cost, cell(row - 1, column - 1))) {
        const step: AlignmentStep =
          cost === 0
            ? { expected: row - 1, kind: "match" }
            : { expected: row - 1, heard: column - 1, kind: "substitute" };

        return walk(row - 1, column - 1, [step, ...steps]);
      }
    }

    if (row > 0 && isStep(current, 1, cell(row - 1, column))) {
      return walk(row - 1, column, [{ expected: row - 1, kind: "delete" }, ...steps]);
    }

    return walk(row, column - 1, [{ heard: column - 1, kind: "insert" }, ...steps]);
  }

  return walk(expected.length, heard.length, []);
}
