import { describe, expect, it } from "vitest";
import { barShares, describeChange } from "./fact-change";

describe(describeChange, () => {
  it("says big changes in times and small ones in percent", () => {
    expect(describeChange(1.5 / 12.5)).toStrictEqual({ kind: "less", times: 8.3 });
    expect(describeChange(3)).toStrictEqual({ kind: "more", times: 3 });
    expect(describeChange(1.15)).toStrictEqual({ kind: "percent", percent: 15 });
    expect(describeChange(0.8)).toStrictEqual({ kind: "percent", percent: -20 });
    expect(describeChange(1)).toStrictEqual({ kind: "same" });
  });
});

describe(barShares, () => {
  it("draws both values on the scale of the larger one", () => {
    expect(barShares(12.5, 1.5)).toStrictEqual({ after: 0.12, before: 1 });
    expect(barShares(2, 8)).toStrictEqual({ after: 1, before: 0.25 });
    expect(barShares(0, 0)).toStrictEqual({ after: 0, before: 0 });
  });
});
