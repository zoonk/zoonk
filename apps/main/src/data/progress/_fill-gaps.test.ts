import { describe, expect, test } from "vitest";
import { fillGapsWithDecay } from "./_fill-gaps";

function utcDate(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

function dateKeys(points: { date: Date }[]): string[] {
  return points.map((point) => point.date.toISOString().slice(0, 10));
}

describe(fillGapsWithDecay, () => {
  test("returns empty array for empty input", () => {
    expect(fillGapsWithDecay([])).toEqual([]);
  });

  test("returns single point unchanged", () => {
    const result = fillGapsWithDecay([{ date: utcDate("2025-01-15"), energy: 50 }]);
    expect(result).toHaveLength(1);
    expect(result[0]?.energy).toBe(50);
  });

  test("fills gaps with decay between two data points", () => {
    const result = fillGapsWithDecay([
      { date: utcDate("2025-01-10"), energy: 75 },
      { date: utcDate("2025-01-14"), energy: 80 },
    ]);

    expect(result).toHaveLength(5);
    expect(dateKeys(result)).toEqual([
      "2025-01-10",
      "2025-01-11",
      "2025-01-12",
      "2025-01-13",
      "2025-01-14",
    ]);
    expect(result.map((point) => point.energy)).toEqual([75, 74, 73, 72, 80]);
  });

  test("produces correct dates across US spring-forward DST boundary", () => {
    // US DST spring forward: March 9, 2025 at 2am → 3am (EST → EDT)
    const result = fillGapsWithDecay([
      { date: utcDate("2025-03-08"), energy: 50 },
      { date: utcDate("2025-03-11"), energy: 60 },
    ]);

    expect(result).toHaveLength(4);
    expect(dateKeys(result)).toEqual(["2025-03-08", "2025-03-09", "2025-03-10", "2025-03-11"]);
  });

  test("produces correct dates across US fall-back DST boundary", () => {
    // US DST fall back: November 2, 2025 at 2am → 1am (EDT → EST)
    const result = fillGapsWithDecay([
      { date: utcDate("2025-11-01"), energy: 50 },
      { date: utcDate("2025-11-04"), energy: 60 },
    ]);

    expect(result).toHaveLength(4);
    expect(dateKeys(result)).toEqual(["2025-11-01", "2025-11-02", "2025-11-03", "2025-11-04"]);
  });

  test("produces correct dates across EU spring-forward DST boundary", () => {
    // EU DST spring forward: March 30, 2025 at 1am UTC → 2am (CET → CEST)
    const result = fillGapsWithDecay([
      { date: utcDate("2025-03-29"), energy: 50 },
      { date: utcDate("2025-04-01"), energy: 60 },
    ]);

    expect(result).toHaveLength(4);
    expect(dateKeys(result)).toEqual(["2025-03-29", "2025-03-30", "2025-03-31", "2025-04-01"]);
  });

  test("decay never goes below MIN_ENERGY (0)", () => {
    const result = fillGapsWithDecay([
      { date: utcDate("2025-01-10"), energy: 2 },
      { date: utcDate("2025-01-15"), energy: 50 },
    ]);

    expect(result).toHaveLength(6);
    expect(result.map((point) => point.energy)).toEqual([2, 1, 0, 0, 0, 50]);
  });
});
