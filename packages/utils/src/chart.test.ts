import { describe, expect, it } from "vitest";
import { buildChartData, formatLabel, isValidChartPayload } from "./chart";

describe(isValidChartPayload, () => {
  it("returns false for non-array values", () => {
    expect(isValidChartPayload(null)).toBe(false);
    expect(isValidChartPayload("string")).toBe(false);
    expect(isValidChartPayload(42)).toBe(false);
    expect(isValidChartPayload({})).toBe(false);
  });

  it("returns false for an empty array", () => {
    expect(isValidChartPayload([])).toBe(false);
  });

  it("returns false when first element has no payload property", () => {
    expect(isValidChartPayload([{ value: 1 }])).toBe(false);
  });

  it("returns false when first element is not an object", () => {
    expect(isValidChartPayload([42])).toBe(false);
    expect(isValidChartPayload(["string"])).toBe(false);
    expect(isValidChartPayload([null])).toBe(false);
  });

  it("returns true for a valid chart payload", () => {
    const payload = [{ payload: { name: "A", value: 10 } }];
    expect(isValidChartPayload(payload)).toBe(true);
  });

  it("returns true for multiple entries", () => {
    const payload = [{ payload: { name: "A", value: 10 } }, { payload: { name: "B", value: 20 } }];
    expect(isValidChartPayload(payload)).toBe(true);
  });

  it("narrows the type correctly", () => {
    const payload: unknown = [{ payload: { name: "A", value: 10 } }];
    const isValidPayload = isValidChartPayload<{ name: string; value: number }>(payload);

    expect(isValidPayload).toBe(true);

    if (!isValidPayload) {
      throw new Error("Expected chart payload to be valid.");
    }

    expect(payload[0].payload.name).toBe("A");
    expect(payload[0].payload.value).toBe(10);
  });
});

describe(formatLabel, () => {
  it("formats month period as day + short month", () => {
    const date = new Date(Date.UTC(2026, 2, 15));
    const result = formatLabel(date, "month", "en");
    expect(result).toContain("Mar");
    expect(result).toContain("15");
  });

  it("formats year period as short month", () => {
    const date = new Date(Date.UTC(2026, 2, 15));
    const result = formatLabel(date, "year", "en");
    expect(result).toBe("Mar");
  });

  it("formats all period as year string", () => {
    const date = new Date(Date.UTC(2026, 0, 1));
    const result = formatLabel(date, "all", "en");
    expect(result).toBe("2026");
  });

  it("formats UTC midnight date correctly (no timezone shift)", () => {
    const date = new Date("2026-03-01T00:00:00Z");
    const result = formatLabel(date, "month", "en");
    expect(result).toContain("Mar");
    expect(result).toContain("1");
  });
});

describe(buildChartData, () => {
  const rawPoints = [
    { count: 10, date: new Date(Date.UTC(2026, 0, 5)) },
    { count: 20, date: new Date(Date.UTC(2026, 0, 6)) },
    { count: 30, date: new Date(Date.UTC(2026, 0, 20)) },
    { count: 40, date: new Date(Date.UTC(2026, 1, 10)) },
  ];

  it("returns daily data points for 'month' period (no aggregation)", () => {
    const result = buildChartData(rawPoints, "month", "en");
    expect(result).toHaveLength(4);
    expect(result.map((dataPoint) => dataPoint.value)).toStrictEqual([10, 20, 30, 40]);
  });

  it("aggregates to monthly sums for 'year' period", () => {
    const result = buildChartData(rawPoints, "year", "en");
    expect(result).toHaveLength(2);
    expect(result.map((dataPoint) => dataPoint.value)).toStrictEqual([60, 40]);
  });

  it("aggregates to yearly sums for 'all' period", () => {
    const crossYearPoints = [
      { count: 10, date: new Date(Date.UTC(2025, 3, 5)) },
      { count: 20, date: new Date(Date.UTC(2025, 8, 6)) },
      { count: 30, date: new Date(Date.UTC(2026, 1, 10)) },
    ];

    const result = buildChartData(crossYearPoints, "all", "en");
    expect(result).toHaveLength(2);
    expect(result.map((dataPoint) => dataPoint.value)).toStrictEqual([30, 30]);
    expect(result.map((dataPoint) => dataPoint.label)).toStrictEqual(["2025", "2026"]);
  });

  it("returns empty data points for empty input", () => {
    const result = buildChartData([], "month", "en");
    expect(result).toStrictEqual([]);
  });
});
