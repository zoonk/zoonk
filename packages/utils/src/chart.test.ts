import { describe, expect, it } from "vitest";
import { isValidChartPayload } from "./chart";

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
