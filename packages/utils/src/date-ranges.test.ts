import { describe, expect, it, vi } from "vitest";
import {
  aggregateByMonth,
  aggregateByWeek,
  aggregateByYear,
  buildChartData,
  calculateDateRanges,
  formatLabel,
  formatPeriodLabel,
  getDefaultStartDate,
  validatePeriod,
} from "./date-ranges";

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

  it("returns 'all' unchanged", () => {
    expect(validatePeriod("all")).toBe("all");
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

  it("returns all-time range for 'all' period", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 2, 15)); // March 15, 2026

    const ranges = calculateDateRanges("all", 0);

    expect(ranges.current.start).toEqual(new Date(2025, 0, 1));
    expect(ranges.current.end).toEqual(new Date(2026, 11, 31));
    expect(ranges.previous.start).toEqual(new Date(0));
    expect(ranges.previous.end).toEqual(new Date(0));

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

  it("formats all period as year string", () => {
    const date = new Date(2026, 0, 1);
    const result = formatLabel(date, "all", "en");
    expect(result).toBe("2026");
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

describe(aggregateByYear, () => {
  const dataPoints = [
    { date: new Date(2025, 3, 10), value: 10 },
    { date: new Date(2025, 8, 20), value: 20 },
    { date: new Date(2026, 1, 5), value: 30 },
  ];

  it("aggregates by sum", () => {
    const result = aggregateByYear(dataPoints, (point) => point.value, "sum");
    expect(result.map((row) => row.value)).toEqual([30, 30]); // 2025: 10+20, 2026: 30
  });

  it("aggregates by average", () => {
    const result = aggregateByYear(dataPoints, (point) => point.value, "average");
    expect(result.map((row) => row.value)).toEqual([15, 30]); // 2025: (10+20)/2, 2026: 30/1
  });

  it("returns sorted results", () => {
    const reversed = [...dataPoints].toReversed();
    const result = aggregateByYear(reversed, (point) => point.value, "sum");
    const times = result.map((row) => row.date.getTime());
    expect(times).toEqual([...times].toSorted((left, right) => left - right));
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

describe(buildChartData, () => {
  const rawPoints = [
    { count: 10, date: new Date(2026, 0, 5) },
    { count: 20, date: new Date(2026, 0, 6) },
    { count: 30, date: new Date(2026, 0, 20) },
    { count: 40, date: new Date(2026, 1, 10) },
  ];

  it("returns daily data points for 'month' period (no aggregation)", () => {
    const result = buildChartData(rawPoints, "month", "en");
    expect(result.dataPoints).toHaveLength(4);
    expect(result.dataPoints.map((dp) => dp.value)).toEqual([10, 20, 30, 40]);
  });

  it("aggregates to weekly sums for '6months' period", () => {
    const result = buildChartData(rawPoints, "6months", "en");
    expect(result.dataPoints.length).toBeLessThan(4);
    const totalValue = result.dataPoints.reduce((sum, dp) => sum + dp.value, 0);
    expect(totalValue).toBe(100);
  });

  it("aggregates to monthly sums for 'year' period", () => {
    const result = buildChartData(rawPoints, "year", "en");
    expect(result.dataPoints).toHaveLength(2);
    expect(result.dataPoints.map((dp) => dp.value)).toEqual([60, 40]);
  });

  it("aggregates to yearly sums for 'all' period", () => {
    const crossYearPoints = [
      { count: 10, date: new Date(2025, 3, 5) },
      { count: 20, date: new Date(2025, 8, 6) },
      { count: 30, date: new Date(2026, 1, 10) },
    ];
    const result = buildChartData(crossYearPoints, "all", "en");
    expect(result.dataPoints).toHaveLength(2);
    expect(result.dataPoints.map((dp) => dp.value)).toEqual([30, 30]);
    expect(result.dataPoints.map((dp) => dp.label)).toEqual(["2025", "2026"]);
  });

  it("returns empty data points and zero average for empty input", () => {
    const result = buildChartData([], "month", "en");
    expect(result).toEqual({ average: 0, dataPoints: [] });
  });

  it("calculates average correctly", () => {
    const result = buildChartData(rawPoints, "month", "en");
    expect(result.average).toBe(Math.round((10 + 20 + 30 + 40) / 4));
  });

  it("calculates average correctly for aggregated data", () => {
    const result = buildChartData(rawPoints, "year", "en");
    expect(result.average).toBe(Math.round((60 + 40) / 2));
  });
});

describe(formatPeriodLabel, () => {
  it("formats month period as full month and year", () => {
    const start = new Date(2026, 2, 1);
    const end = new Date(2026, 2, 31);
    const result = formatPeriodLabel(start, end, "month", "en");
    expect(result).toBe("March 2026");
  });

  it("formats 6months period as short month range with year", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 5, 30);
    const result = formatPeriodLabel(start, end, "6months", "en");
    expect(result).toBe("Jan - Jun 2026");
  });

  it("formats year period as year number", () => {
    const start = new Date(2026, 0, 1);
    const end = new Date(2026, 11, 31);
    const result = formatPeriodLabel(start, end, "year", "en");
    expect(result).toBe("2026");
  });

  it("formats all period as year range", () => {
    const start = new Date(2025, 0, 1);
    const end = new Date(2026, 11, 31);
    const result = formatPeriodLabel(start, end, "all", "en");
    expect(result).toBe("2025 - 2026");
  });
});
