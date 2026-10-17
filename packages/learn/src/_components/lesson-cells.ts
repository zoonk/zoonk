/** Cells in sight in one row; past this many lessons each cell holds an equal share of them. */
const MAX_CELLS = 30;

/** How much of the range `[start, end)` falls in `[from, to)`. */
function overlap({
  end,
  from,
  start,
  to,
}: {
  end: number;
  from: number;
  start: number;
  to: number;
}) {
  return Math.max(0, Math.min(end, to) - Math.max(start, from));
}

export type LessonCounts = {
  known: number;
  studied: number;
  /** Today's lessons still to do. */
  today: number;
  total: number;
};

/** One cell's fills: its studied and known shares (0 to 1) and whether it's today's. */
type LessonCell = { known: number; planned: boolean; studied: number };

/**
 * A plan's lessons as cells, in the order they count: studied, known, today's still to do, then
 * the rest. One cell per lesson up to 30; past that each cell holds an equal share of them (the
 * last one what's left) and fills partly, and today's few lessons are too small a part of one to
 * outline.
 */
export function getLessonCells({ known, studied, today, total }: LessonCounts): LessonCell[] {
  const size = Math.max(1, Math.ceil(total / MAX_CELLS));
  const done = studied + known;

  return Array.from({ length: Math.ceil(total / size) }, (_, index) => {
    const start = index * size;
    const end = Math.min(total, start + size);
    const length = end - start;

    return {
      known: overlap({ end, from: studied, start, to: done }) / length,
      planned: size === 1 && start >= done && start < done + today,
      studied: overlap({ end, from: 0, start, to: studied }) / length,
    };
  });
}
