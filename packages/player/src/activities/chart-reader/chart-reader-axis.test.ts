import { describe, expect, it } from "vitest";
import { chartReaderTicks } from "./chart-reader-axis";

describe(chartReaderTicks, () => {
  it("marks each whole hour in an intraday price chart", () => {
    expect(chartReaderTicks({ domain: [10, 15], label: "Hour of the day" })).toStrictEqual([
      10, 11, 12, 13, 14, 15,
    ]);
  });
});
