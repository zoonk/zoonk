const MAX_CELLS = 30;

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

export type LessonCounts = { known: number; studied: number; today: number; total: number };

type LessonCell = { known: number; planned: boolean; studied: number };

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
