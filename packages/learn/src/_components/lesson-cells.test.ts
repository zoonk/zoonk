import { describe, expect, it } from "vitest";
import { getLessonCells } from "./lesson-cells";

describe(getLessonCells, () => {
  it("draws one cell per lesson: studied, known, today's outlined, then the rest", () => {
    const cells = getLessonCells({ known: 1, studied: 2, today: 2, total: 6 });

    expect(cells).toStrictEqual([
      { known: 0, planned: false, studied: 1 },
      { known: 0, planned: false, studied: 1 },
      { known: 1, planned: false, studied: 0 },
      { known: 0, planned: true, studied: 0 },
      { known: 0, planned: true, studied: 0 },
      { known: 0, planned: false, studied: 0 },
    ]);
  });

  it("keeps one cell per lesson up to 30", () => {
    expect(getLessonCells({ known: 0, studied: 6, today: 2, total: 30 })).toHaveLength(30);
  });

  it("shares larger plans out among cells that fill partly, with no outline", () => {
    const cells = getLessonCells({ known: 4, studied: 10, today: 3, total: 227 });

    // 227 lessons: cells of 8, the last holding the 3 left.
    expect(cells).toHaveLength(29);
    expect(cells[0]).toStrictEqual({ known: 0, planned: false, studied: 1 });
    expect(cells[1]).toStrictEqual({ known: 0.5, planned: false, studied: 0.25 });
    expect(cells[2]).toStrictEqual({ known: 0, planned: false, studied: 0 });
    expect(cells.some((cell) => cell.planned)).toBe(false);

    const filled = cells.reduce((sum, cell, index) => {
      const size = index === cells.length - 1 ? 3 : 8;
      return sum + (cell.studied + cell.known) * size;
    }, 0);

    expect(filled).toBe(14);
  });

  it("draws nothing for a plan without lessons", () => {
    expect(getLessonCells({ known: 0, studied: 0, today: 0, total: 0 })).toStrictEqual([]);
  });
});
