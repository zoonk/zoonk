const MAX_CELLS = 30;

export type LessonCounts = { known: number; studied: number; today: number; total: number };

type LessonCell = { known: number; planned: boolean; studied: number };

/** Each state's share of `count` cells, rounded so the shares add up to `count` exactly. */
function shareCells({
  count,
  lessons,
  total,
}: {
  count: number;
  lessons: number[];
  total: number;
}) {
  const exact = lessons.map((value) => (value * count) / total);
  const cells = exact.map((value) => Math.floor(value));
  const left = count - cells.reduce((sum, value) => sum + value, 0);

  exact
    .map((value, state) => ({ rest: value - Math.floor(value), state }))
    .toSorted((a, b) => b.rest - a.rest)
    .slice(0, left)
    .forEach(({ state }) => {
      cells[state] = (cells[state] ?? 0) + 1;
    });

  return cells;
}

/** A state the legend names gets one cell at least, taken from the state holding the most, so the bar never draws less than it says. */
function giveEveryStateACell({ cells, lessons }: { cells: number[]; lessons: number[] }) {
  return lessons.reduce((result, value, state) => {
    if (value === 0 || (result[state] ?? 0) > 0) {
      return result;
    }

    const largest = result.indexOf(Math.max(...result));

    return result.map((cellCount, index) => {
      if (index === state) {
        return 1;
      }

      return index === largest ? cellCount - 1 : cellCount;
    });
  }, cells);
}

/**
 * Up to 30 cells, each one whole state: a cell stands for `size` lessons once the plan is longer,
 * and each state takes its share of the cells, studied, known, today's, then the rest.
 */
export function getLessonCells({ known, studied, today, total }: LessonCounts): LessonCell[] {
  const size = Math.max(1, Math.ceil(total / MAX_CELLS));
  const count = Math.ceil(total / size);
  const lessons = [studied, known, today, Math.max(0, total - studied - known - today)];
  const shares = total > 0 ? shareCells({ count, lessons, total }) : [0, 0, 0, 0];

  const [studiedCells = 0, knownCells = 0, todayCells = 0] = giveEveryStateACell({
    cells: shares,
    lessons,
  });

  return Array.from({ length: count }, (_, index) => ({
    known: index >= studiedCells && index < studiedCells + knownCells ? 1 : 0,
    planned: index >= studiedCells + knownCells && index < studiedCells + knownCells + todayCells,
    studied: index < studiedCells ? 1 : 0,
  }));
}
