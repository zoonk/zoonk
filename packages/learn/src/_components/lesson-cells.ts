const MAX_CELLS = 30;

export type LessonCounts = { known: number; studied: number; today: number; total: number };

type LessonCell = { known: number; planned: boolean; studied: number };

/** A state the legend names gets one cell at least, so the bar never draws less than it says. */
function cellsFor({ lessons, size }: { lessons: number; size: number }) {
  return lessons > 0 ? Math.max(1, Math.round(lessons / size)) : 0;
}

/**
 * Up to 30 cells, each one whole state: a cell stands for `size` lessons once the plan is longer,
 * and each state takes its share of the cells, rounded.
 */
export function getLessonCells({ known, studied, today, total }: LessonCounts): LessonCell[] {
  const size = Math.max(1, Math.ceil(total / MAX_CELLS));
  const count = Math.ceil(total / size);
  const studiedCells = cellsFor({ lessons: studied, size });
  const doneCells = Math.max(studiedCells, cellsFor({ lessons: studied + known, size }));
  const knownCells = known > 0 ? Math.max(1, doneCells - studiedCells) : 0;

  const todayCells = Math.min(
    cellsFor({ lessons: today, size }),
    count - studiedCells - knownCells,
  );

  return Array.from({ length: count }, (_, index) => ({
    known: index >= studiedCells && index < studiedCells + knownCells ? 1 : 0,
    planned: index >= studiedCells + knownCells && index < studiedCells + knownCells + todayCells,
    studied: index < studiedCells ? 1 : 0,
  }));
}
