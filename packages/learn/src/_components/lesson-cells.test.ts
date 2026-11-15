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

  it("gives larger plans whole cells, each state the legend names at least one", () => {
    const cells = getLessonCells({ known: 4, studied: 10, today: 3, total: 227 });

    expect(cells).toHaveLength(29);

    expect(cells.slice(0, 4)).toStrictEqual([
      { known: 0, planned: false, studied: 1 },
      { known: 1, planned: false, studied: 0 },
      { known: 0, planned: true, studied: 0 },
      { known: 0, planned: false, studied: 0 },
    ]);

    expect(cells.every((cell) => cell.studied % 1 === 0 && cell.known % 1 === 0)).toBe(true);
  });

  it("rounds a state's cells to its share of the plan", () => {
    const cells = getLessonCells({ known: 0, studied: 40, today: 20, total: 300 });

    expect(cells.filter((cell) => cell.studied === 1)).toHaveLength(4);
    expect(cells.filter((cell) => cell.planned)).toHaveLength(2);
  });

  it("keeps a few studied lessons visible in a long plan", () => {
    const cells = getLessonCells({ known: 0, studied: 4, today: 0, total: 300 });

    expect(cells[0]).toStrictEqual({ known: 0, planned: false, studied: 1 });
    expect(cells.filter((cell) => cell.studied > 0)).toHaveLength(1);
  });

  it("draws nothing for a plan without lessons", () => {
    expect(getLessonCells({ known: 0, studied: 0, today: 0, total: 0 })).toStrictEqual([]);
  });
});
