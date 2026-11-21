import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import {
  type LinearScale,
  createLinearScale,
  fittingTickIndices,
  formatTicks,
  getPlotAxes,
} from "@zoonk/utils/plot-scale";
import { type TextWidth, estimateTextWidth, getWidestWord } from "./category-labels";
import { AXIS_LABEL_OFFSET, HEIGHT, LABEL_GAP, PADDING, type PlacedTick } from "./chart-layout";
import {
  MAX_GUTTER_SHARE,
  MIN_PLOT_WIDTH,
  type Measure,
  type PlannedMark,
  REFERENCE_INSET,
  type ReferenceMark,
  planReferences,
} from "./plot-references";
import {
  type KeyEntry,
  type Pixel,
  type PointLabel,
  type Segment,
  getPointLabels,
} from "./point-labels";

const CORNER_CLEARANCE = 2;
const GRID_SNAP = 1;

type Mark = PlotVisual["series"][number]["mark"];

type PlotTick = { label: string; line: boolean; value: number };

export type PlotLayout = {
  key: KeyEntry[];
  labels: PointLabel[];
  left: number;
  plotBottom: number;
  plotRight: number;
  references: ReferenceMark[];
  series: Pixel[][];
  x: LinearScale;
  xTickY: number;
  xTicks: PlacedTick[];
  y: LinearScale;
  yTicks: PlotTick[];
};

function measure(textWidth: TextWidth): Measure {
  return { labelWidth: (text) => textWidth(text) + LABEL_GAP, textWidth };
}

function getGutters({
  locale,
  measured,
  visual,
}: {
  locale: string;
  measured: Measure;
  visual: PlotVisual;
}) {
  const axes = getPlotAxes(visual);
  const labels = formatTicks({ axis: "y", locale, ticks: axes.y.ticks });
  const names = visual.references.map(({ label }) => label);

  return {
    axes,
    left: Math.max(PADDING.left, ...labels.map((label) => measured.labelWidth(label))),
    longest: Math.max(0, ...names.map((name) => measured.labelWidth(name))),
    widestWord: getWidestWord(names, measured.labelWidth),
    yLabels: labels,
  };
}

/**
 * The drawing's text grows with the browser's text size until the plot area would get narrower
 * than `MIN_PLOT_WIDTH`, counting reference names wrapped as narrow as their widest word; the text
 * around the drawing keeps growing.
 */
export function getPlotTextScale({
  boxWidth,
  locale,
  textScale,
  textWidth = estimateTextWidth,
  visual,
}: {
  boxWidth: number;
  locale: string;
  textScale: number;
  textWidth?: TextWidth;
  visual: PlotVisual;
}): number {
  const { left, longest, widestWord } = getGutters({
    locale,
    measured: measure(textWidth),
    visual,
  });

  const named = visual.references.length > 0;
  const fixed = left + (named ? REFERENCE_INSET : PADDING.right) + MIN_PLOT_WIDTH;

  const minWidth = named
    ? Math.min(fixed + longest, Math.max(fixed / (1 - MAX_GUTTER_SHARE), fixed + widestWord))
    : fixed;

  return Math.min(textScale, Math.max(boxWidth / minWidth, 1));
}

/** A bare line beside other series marks its end with its shape, so shape tells series apart too. */
export function drawsDot({
  index,
  mark,
  pointCount,
  seriesCount,
}: {
  index: number;
  mark: Mark;
  pointCount: number;
  seriesCount: number;
}): boolean {
  if (mark !== "line") {
    return true;
  }

  return seriesCount > 1 && index === pointCount - 1;
}

function getSegments({
  marks,
  references,
  series,
  x,
}: {
  marks: Mark[];
  references: PlannedMark[];
  series: Pixel[][];
  x: LinearScale;
}): Segment[] {
  const lines = series.flatMap((points, index) =>
    marks[index] === "points"
      ? []
      : points.slice(1).map((point, pointIndex): Segment => [points[pointIndex] ?? point, point]),
  );

  const [start, end] = x.range;

  const rules = references.map(({ y }): Segment => [
    { x: start, y },
    { x: end, y },
  ]);

  return [...lines, ...rules];
}

/**
 * Each number sits centered under its value. The first or last one is left out when it would
 * reach the y axis's numbers or past the drawing's edge, and the rest thin out evenly when they
 * would touch.
 */
function placeXTicks({
  labels,
  left,
  measured,
  ticks,
  width,
  x,
}: {
  labels: string[];
  left: number;
  measured: Measure;
  ticks: number[];
  width: number;
  x: LinearScale;
}): PlacedTick[] {
  const placed = ticks
    .map((value, index) => {
      const label = labels[index] ?? "";
      const center = x.toPixel(value);
      const half = measured.textWidth(label) / 2;

      return { center, frame: { left: center - half, right: center + half }, label, value };
    })
    .filter(
      ({ frame }) => frame.left >= left - LABEL_GAP + CORNER_CLEARANCE && frame.right <= width,
    );

  const kept = fittingTickIndices(
    placed.map(({ frame }) => frame),
    LABEL_GAP,
  );

  return placed
    .filter((_, index) => kept.includes(index))
    .map(({ center, label, value }) => ({ center, label, value }));
}

export function getPlotLayout({
  locale,
  textWidth = estimateTextWidth,
  visual,
  width,
}: {
  locale: string;
  textWidth?: TextWidth;
  visual: PlotVisual;
  width: number;
}): PlotLayout {
  const measured = measure(textWidth);
  const { axes, left, yLabels } = getGutters({ locale, measured, visual });
  const plotBottom = HEIGHT - PADDING.bottom;
  const y = createLinearScale({ domain: axes.y.domain, range: [plotBottom, PADDING.top] });

  const plan = planReferences({ left, measured, references: visual.references, width, y });
  const plotRight = Math.max(width - plan.width, left + 1);
  const x = createLinearScale({ domain: axes.x.domain, range: [left, plotRight] });
  const marks = visual.series.map((item) => item.mark);

  const series = visual.series.map((item) =>
    item.points.map((point) => ({ x: x.toPixel(point.x), y: y.toPixel(point.y) })),
  );

  const dots = series.flatMap((points, seriesIndex) =>
    points.filter((_, index) =>
      drawsDot({
        index,
        mark: marks[seriesIndex] ?? "points",
        pointCount: points.length,
        seriesCount: series.length,
      }),
    ),
  );

  const named = visual.series.flatMap((item, seriesIndex) =>
    item.points.flatMap((point, index) => {
      const dot = series[seriesIndex]?.[index];
      return point.label && dot ? [{ dot, text: point.label }] : [];
    }),
  );

  const points = getPointLabels({
    firstMarker: plan.key.length + 1,
    named,
    scene: {
      bounds: {
        bottom: plotBottom,
        left,
        right: plan.marks.length > 0 ? plotRight : width,
        top: 0,
      },
      dots,
      segments: getSegments({ marks, references: plan.marks, series, x }),
      textWidth,
    },
  });

  const yTicks = axes.y.ticks.map((value, index) => ({
    label: yLabels[index] ?? "",
    line: plan.marks.every((mark) => Math.abs(mark.y - y.toPixel(value)) >= GRID_SNAP),
    value,
  }));

  return {
    key: [...plan.key, ...points.key],
    labels: points.labels,
    left,
    plotBottom,
    plotRight,
    references: plan.marks.map(({ offset, ...mark }) => ({
      ...mark,
      x: plotRight + REFERENCE_INSET + offset,
    })),
    series,
    x,
    xTickY: plotBottom + AXIS_LABEL_OFFSET,
    xTicks: placeXTicks({
      labels: formatTicks({ axis: "x", locale, ticks: axes.x.ticks }),
      left,
      measured,
      ticks: axes.x.ticks,
      width,
      x,
    }),
    y,
    yTicks,
  };
}
