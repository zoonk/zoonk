import { describe, expect, it } from "vitest";
import { type ChartVisual, lessonVisualSchema } from "./visual-schema";

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

describe("lesson visual schema", () => {
  it("takes a chart's categories, series and a timeline's events past the prompt's counts", () => {
    const timeline = {
      events: Array.from({ length: 11 }, (_, index) => ({
        date: String(1900 + index),
        detail: null,
        label: `Event ${index + 1}`,
      })),
      kind: "timeline",
      title: "A century",
    };

    expect(lessonVisualSchema.safeParse(chart(7)).success).toBe(true);
    expect(lessonVisualSchema.safeParse(timeline).success).toBe(true);
  });
});
