import { describe, expect, it } from "vitest";
import { buildChartData, formatLabel, isValidChartPayload } from "./chart";

describe(isValidChartPayload, () => {
  it("returns false for non-array values", () => {
    expect(isValidChartPayload(null)).toBeFalsy();
    expect(isValidChartPayload("string")).toBeFalsy();
    expect(isValidChartPayload(42)).toBeFalsy();
    expect(isValidChartPayload({})).toBeFalsy();
  });

  it("returns false for an empty array", () => {
    expect(isValidChartPayload([])).toBeFalsy();
  });

  it("returns false when first element has no payload property", () => {
    expect(isValidChartPayload([{ value: 1 }])).toBeFalsy();
  });

  it("returns false when first element is not an object", () => {
    expect(isValidChartPayload([42])).toBeFalsy();
    expect(isValidChartPayload(["string"])).toBeFalsy();
    expect(isValidChartPayload([null])).toBeFalsy();
  });

  it("returns true for a valid chart payload", () => {
    const payload = [{ payload: { name: "A", value: 10 } }];
    expect(isValidChartPayload(payload)).toBeTruthy();
  });

  it("returns true for multiple entries", () => {
    const payload = [{ payload: { name: "A", value: 10 } }, { payload: { name: "B", value: 20 } }];
    expect(isValidChartPayload(payload)).toBeTruthy();
  });

  it("narrows the type correctly", () => {
    const payload: unknown = [{ payload: { name: "A", value: 10 } }];

    if (isValidChartPayload<{ name: string; value: number }>(payload)) {
      expect(payload[0].payload.name).toBe("A");
      expect(payload[0].payload.value).toBe(10);
    }
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
