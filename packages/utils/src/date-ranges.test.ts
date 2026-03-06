import { describe, expect, it, vi } from "vitest";
import {
  calculateDateRanges,
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
