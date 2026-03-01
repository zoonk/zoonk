import { describe, expect, it, vi } from "vitest";
import {
  type ScoredRow,
  aggregateByMonth,
  aggregateByWeek,
  aggregateScoreByMonth,
  aggregateScoreByWeek,
  calculateDateRanges,
  findBestByScore,
  formatLabel,
  getDefaultStartDate,
  validatePeriod,
} from "./date-ranges";

function calcScore(correct: number, incorrect: number) {
  return (correct / (correct + incorrect)) * 100;
}

describe(validatePeriod, () => {
  it("returns 'month' unchanged", () => {
    expect(validatePeriod("month")).toBe("month");
  });

  it("returns '6months' unchanged", () => {
    expect(validatePeriod("6months")).toBe("6months");
  });

  it("returns 'year' unchanged", () => {
    expect(validatePeriod("year")).toBe("year");
  });

  it("defaults invalid value to 'month'", () => {
    expect(validatePeriod("invalid")).toBe("month");
  });

  it("defaults empty string to 'month'", () => {
    expect(validatePeriod("")).toBe("month");
  });
});

describe(calculateDateRanges, () => {
  it("returns current and previous month for 'month' period in March", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

    const ranges = calculateDateRanges("month", 0);

    expect(ranges.current.start).toEqual(new Date(2026, 2, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 2, 31));
    expect(ranges.previous.start).toEqual(new Date(2026, 1, 1));
    expect(ranges.previous.end).toEqual(new Date(2026, 1, 28));

    vi.useRealTimers();
  });

  it("returns offset month for 'month' period with offset=1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

    const ranges = calculateDateRanges("month", 1);

    expect(ranges.current.start).toEqual(new Date(2026, 1, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 1, 28));
    expect(ranges.previous.start).toEqual(new Date(2026, 0, 1));
    expect(ranges.previous.end).toEqual(new Date(2026, 0, 31));

    vi.useRealTimers();
  });

  it("returns correct half-year ranges in January (H1)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15)); // January 15, 2026

    const ranges = calculateDateRanges("6months", 0);

    expect(ranges.current.start).toEqual(new Date(2026, 0, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 5, 30));
    expect(ranges.previous.start).toEqual(new Date(2025, 6, 1));
    expect(ranges.previous.end).toEqual(new Date(2025, 11, 31));

    vi.useRealTimers();
  });

  it("returns correct half-year ranges in July (H2)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 15)); // July 15, 2026

    const ranges = calculateDateRanges("6months", 0);

    expect(ranges.current.start).toEqual(new Date(2026, 6, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 11, 31));
    expect(ranges.previous.start).toEqual(new Date(2026, 0, 1));
    expect(ranges.previous.end).toEqual(new Date(2026, 5, 30));

    vi.useRealTimers();
  });

  it("returns correct year ranges in March", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

    const ranges = calculateDateRanges("year", 0);

    expect(ranges.current.start).toEqual(new Date(2026, 0, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 11, 31));
    expect(ranges.previous.start).toEqual(new Date(2025, 0, 1));
    expect(ranges.previous.end).toEqual(new Date(2025, 11, 31));

    vi.useRealTimers();
  });

  it("returns correct year ranges in December", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 11, 25)); // December 25, 2026

    const ranges = calculateDateRanges("year", 0);

    expect(ranges.current.start).toEqual(new Date(2026, 0, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 11, 31));
    expect(ranges.previous.start).toEqual(new Date(2025, 0, 1));
    expect(ranges.previous.end).toEqual(new Date(2025, 11, 31));

    vi.useRealTimers();
  });

  it("returns offset year ranges with offset=1", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

    const ranges = calculateDateRanges("year", 1);

    expect(ranges.current.start).toEqual(new Date(2025, 0, 1));
    expect(ranges.current.end).toEqual(new Date(2025, 11, 31));
    expect(ranges.previous.start).toEqual(new Date(2024, 0, 1));
    expect(ranges.previous.end).toEqual(new Date(2024, 11, 31));

    vi.useRealTimers();
  });
});

describe(formatLabel, () => {
  it("formats month period as day + short month", () => {
    const date = new Date(2026, 2, 15);
    const result = formatLabel(date, "month", "en");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
  });

  it("formats 6months period as week number", () => {
    const date = new Date(2026, 0, 15);
    const result = formatLabel(date, "6months", "en");
    expect(result).toMatch(/^W\d+$/);
  });

  it("formats year period as short month", () => {
    const date = new Date(2026, 2, 15);
    const result = formatLabel(date, "year", "en");
    expect(result).toBe("Mar");
  });
});

describe(aggregateByWeek, () => {
  const dataPoints = [
    { date: new Date(2026, 2, 2), value: 10 }, // Monday
    { date: new Date(2026, 2, 3), value: 20 }, // Tuesday (same week)
    { date: new Date(2026, 2, 9), value: 30 }, // Next Monday (different week)
  ];

  it("aggregates by sum", () => {
    const result = aggregateByWeek(dataPoints, (point) => point.value, "sum");
    expect(result.map((row) => row.value)).toEqual([30, 30]); // 10+20, 30
  });

  it("aggregates by average", () => {
    const result = aggregateByWeek(dataPoints, (point) => point.value, "average");
    expect(result.map((row) => row.value)).toEqual([15, 30]); // (10+20)/2, 30/1
  });

  it("returns sorted results", () => {
    const reversed = [...dataPoints].toReversed();
    const result = aggregateByWeek(reversed, (point) => point.value, "sum");
    const times = result.map((row) => row.date.getTime());
    expect(times).toEqual([...times].toSorted((left, right) => left - right));
  });
});

describe(aggregateByMonth, () => {
  const dataPoints = [
    { date: new Date(2026, 0, 5), value: 10 },
    { date: new Date(2026, 0, 20), value: 20 },
    { date: new Date(2026, 1, 10), value: 30 },
  ];

  it("aggregates by sum", () => {
    const result = aggregateByMonth(dataPoints, (point) => point.value, "sum");
    expect(result.map((row) => row.value)).toEqual([30, 30]); // Jan: 10+20, Feb: 30
  });

  it("aggregates by average", () => {
    const result = aggregateByMonth(dataPoints, (point) => point.value, "average");
    expect(result.map((row) => row.value)).toEqual([15, 30]); // Jan: (10+20)/2, Feb: 30/1
  });

  it("returns sorted results", () => {
    const reversed = [...dataPoints].toReversed();
    const result = aggregateByMonth(reversed, (point) => point.value, "sum");
    const times = result.map((row) => row.date.getTime());
    expect(times).toEqual([...times].toSorted((left, right) => left - right));
  });
});

describe(aggregateScoreByWeek, () => {
  it("aggregates correct/incorrect by week and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(2026, 2, 2), incorrect: 2 }, // Monday
      { correct: 6, date: new Date(2026, 2, 3), incorrect: 4 }, // Tuesday (same week)
      { correct: 9, date: new Date(2026, 2, 9), incorrect: 1 }, // Next Monday
    ];

    const result = aggregateScoreByWeek(dataPoints, calcScore);

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // Week 1: 8+6=14 correct, 2+4=6 incorrect
      calcScore(9, 1), // Week 2: 9 correct, 1 incorrect
    ]);
  });
});

describe(aggregateScoreByMonth, () => {
  it("aggregates correct/incorrect by month and calculates score", () => {
    const dataPoints = [
      { correct: 8, date: new Date(2026, 0, 5), incorrect: 2 },
      { correct: 6, date: new Date(2026, 0, 20), incorrect: 4 },
      { correct: 9, date: new Date(2026, 1, 10), incorrect: 1 },
    ];

    const result = aggregateScoreByMonth(dataPoints, calcScore);

    expect(result.map((row) => row.score)).toEqual([
      calcScore(14, 6), // Jan
      calcScore(9, 1), // Feb
    ]);
  });
});

describe(getDefaultStartDate, () => {
  it("returns parsed date from ISO string", () => {
    const iso = "2026-01-15T00:00:00.000Z";
    const result = getDefaultStartDate(iso);
    expect(result.toISOString()).toBe(iso);
  });

  it("returns lookback date when no ISO string provided", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15));

    const result = getDefaultStartDate();
    const expected = new Date(2026, 2, 15);
    expected.setDate(expected.getDate() - 90);

    expect(result.toISOString().slice(0, 10)).toBe(expected.toISOString().slice(0, 10));

    vi.useRealTimers();
  });
});

describe(findBestByScore, () => {
  it("finds row with highest score", () => {
    const rows: ScoredRow[] = [
      { correct: 7, incorrect: 3, key: 1 },
      { correct: 9, incorrect: 1, key: 2 },
      { correct: 5, incorrect: 5, key: 3 },
    ];

    const result = findBestByScore(rows);
    expect(result).toEqual({ key: 2, score: 90 });
  });

  it("breaks ties by total", () => {
    const rows: ScoredRow[] = [
      { correct: 8, incorrect: 2, key: 1 }, // 80%, total 10
      { correct: 16, incorrect: 4, key: 2 }, // 80%, total 20
    ];

    const result = findBestByScore(rows);
    expect(result).toEqual({ key: 2, score: 80 });
  });

  it("returns null for empty array", () => {
    expect(findBestByScore([])).toBeNull();
  });

  it("returns null when all rows have zero data", () => {
    const rows: ScoredRow[] = [{ correct: 0, incorrect: 0, key: 1 }];
    expect(findBestByScore(rows)).toBeNull();
  });
});
