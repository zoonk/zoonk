import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { describe, expect, it } from "vitest";
import { getLabelWidth } from "./category-labels";
import { PADDING, fitsLabel, getLayout } from "./chart-layout";

const visual: ChartVisual = {
  axisStart: null,
  categories: ["May", "Jun", "Jul"],
  categoryLabel: "Month",
  chart: "bar",
  kind: "chart",
  series: [{ name: "Letters", values: [35, 36, 40] }],
  source: null,
  title: "Letters answered",
  unit: null,
  valueLabel: "Letters",
};

describe(getLayout, () => {
  it("keeps the axis width for short tick labels", () => {
    const layout = getLayout({ formatTick: String, visual, width: 320 });
    expect(layout.left).toBe(PADDING.left);
  });

  it("widens the axis so a long tick label isn't cut off", () => {
    const layout = getLayout({ formatTick: (tick) => `${tick} hours/day`, visual, width: 320 });

    expect(layout.left).toBeGreaterThan(PADDING.left);
    expect(layout.yTicks.every((tick) => getLabelWidth(tick.label) <= layout.left)).toBe(true);
  });
});

describe(fitsLabel, () => {
  it("fits a label only when it's no wider than its room", () => {
    expect(fitsLabel("40", 30)).toBe(true);
    expect(fitsLabel("40 hours/day", 30)).toBe(false);
  });
});
