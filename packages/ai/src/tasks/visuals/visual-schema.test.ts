import { describe, expect, it } from "vitest";
import { type ChartVisual, fitVisual, lessonVisualSchema } from "./visual-schema";

const months = Array.from({ length: 14 }, (_, index) => `M${index + 1}`);

function chart(seriesCount: number): ChartVisual {
  return {
    axisStart: null,
    categories: months,
    categoryLabel: "Month",
    chart: "line",
    kind: "chart",
    series: Array.from({ length: seriesCount }, (_, index) => ({
      name: `Series ${index + 1}`,
      values: months.map((_month, position) => position + index),
    })),
    source: null,
    title: "Sales by month",
    unit: null,
    valueLabel: "Sales",
  };
}

describe(fitVisual, () => {
  it("takes a chart or timeline past the prompt's counts", () => {
    const timeline = {
      events: Array.from({ length: 11 }, (_, index) => ({
        date: String(1900 + index),
        detail: null,
        label: `Event ${index + 1}`,
      })),
      kind: "timeline",
      title: "A century",
    };

    expect(lessonVisualSchema.safeParse(chart(5)).success).toBe(true);
    expect(lessonVisualSchema.safeParse(timeline).success).toBe(true);
  });

  it("keeps a chart's first three series, the ones the app has colors for", () => {
    const fitted = fitVisual(chart(5));

    expect(fitted).toStrictEqual({ ...chart(5), series: chart(5).series.slice(0, 3) });
    expect(fitVisual(chart(3))).toStrictEqual(chart(3));
  });
});
