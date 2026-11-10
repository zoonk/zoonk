import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import { createLinearScale, niceDomain, niceTicks } from "@zoonk/utils/plot-scale";
import { type CategoryLabelLayout, getCategoryLabels, getLabelWidth } from "./category-labels";

export const HEIGHT = 208;
export const PADDING = { bottom: 26, left: 48, right: 8, top: 22 } as const;
export const LABEL_GAP = 6;
export const LABEL_LINE_HEIGHT = 14;
const TICK_COUNT = 4;

export type Layout = {
  band: number;
  center: (index: number) => number;
  labels: CategoryLabelLayout;
  left: number;
  y: ReturnType<typeof createLinearScale>;
  yTicks: { label: string; value: number }[];
};

export function fitsLabel(label: string, room: number): boolean {
  return getLabelWidth(label) <= room + LABEL_GAP;
}

export function getLayout({
  formatTick,
  visual,
  width,
}: {
  formatTick: (tick: number) => string;
  visual: ChartVisual;
  width: number;
}): Layout {
  const values = visual.series.flatMap((series) => series.values);
  const anchors = visual.axisStart === null ? values : [...values, visual.axisStart];
  const nice = niceDomain(anchors, { includeZero: visual.chart === "bar" });

  const yDomain = visual.axisStart === null ? nice : ([visual.axisStart, nice[1]] as const);
  const wholeNumbers = values.every((value) => Number.isInteger(value));

  const yTicks = niceTicks(yDomain, TICK_COUNT)
    .filter((tick) => !wholeNumbers || Number.isInteger(tick))
    .map((value) => ({ label: formatTick(value), value }));

  const left = Math.max(PADDING.left, ...yTicks.map((tick) => getLabelWidth(tick.label)));
  const plotWidth = Math.max(width - left - PADDING.right, 1);
  const band = plotWidth / visual.categories.length;

  return {
    band,
    center: (index) => left + band * index + band / 2,
    labels: getCategoryLabels({ band, categories: visual.categories }),
    left,
    y: createLinearScale({ domain: yDomain, range: [HEIGHT - PADDING.bottom, PADDING.top] }),
    yTicks,
  };
}

export function getChartHeight(layout: Layout): number {
  const lines = Math.max(...layout.labels.lines.map((label) => label.length));
  return HEIGHT + (lines - 1) * LABEL_LINE_HEIGHT;
}
