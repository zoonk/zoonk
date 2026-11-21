import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { type LinearScale, createLinearScale, getPlotAxes } from "@zoonk/utils/plot-scale";
import { getLabelWidth, getWidestWord, wrapLabel } from "./category-labels";
import {
  AXIS_LABEL_OFFSET,
  HEIGHT,
  LABEL_GAP,
  LABEL_LINE_HEIGHT,
  PADDING,
  type PlacedTick,
  thinTicks,
} from "./chart-layout";
import {
  DOT_RADIUS,
  type KeyEntry,
  type Pixel,
  type PointLabel,
  type Segment,
  getPointLabels,
} from "./point-labels";

const MAX_GUTTER_SHARE = 0.3;
const REFERENCE_SPACING = 2;
const REFERENCE_INSET = DOT_RADIUS + LABEL_GAP;

type Tick = { label: string; value: number };

type Mark = PlotVisual["series"][number]["mark"];

type ReferenceMark = { label: string; lines: string[]; top: number; y: number };

export type PlotLayout = {
  key: KeyEntry[];
  labels: PointLabel[];
  left: number;
  plotBottom: number;
  plotRight: number;
  referenceLabelX: number;
  references: ReferenceMark[];
  series: Pixel[][];
  x: LinearScale;
  xTickY: number;
  xTicks: PlacedTick[];
  y: LinearScale;
  yTicks: Tick[];
};

function blockHeight(mark: ReferenceMark): number {
  return mark.lines.length * LABEL_LINE_HEIGHT;
}

function stackReferences({
  bottom,
  marks,
}: {
  bottom: number;
  marks: ReferenceMark[];
}): ReferenceMark[] {
  const stacked: ReferenceMark[] = [];

  for (const mark of marks.toSorted((a, b) => a.y - b.y)) {
    const previous = stacked.at(-1);
    const floor = previous ? previous.top + blockHeight(previous) + REFERENCE_SPACING : 0;
    stacked.push({ ...mark, top: Math.max(mark.top, floor) });
  }

  const last = stacked.at(-1);
  const overflow = last ? last.top + blockHeight(last) - bottom : 0;

  return overflow > 0 ? stacked.map((mark) => ({ ...mark, top: mark.top - overflow })) : stacked;
}

function getReferences({
  references,
  room,
  y,
}: {
  references: PlotVisual["references"];
  room: number;
  y: LinearScale;
}): ReferenceMark[] {
  const marks = references.map((reference) => {
    const lines = wrapLabel({ label: reference.label, room });
    const lineY = y.toPixel(reference.y);
    const top = lineY - (lines.length * LABEL_LINE_HEIGHT) / 2;

    return { label: reference.label, lines, top, y: lineY };
  });

  return stackReferences({ bottom: y.range[0], marks });
}

/**
 * Reference names sit past the plot's right edge, clear of a point drawn on that edge, so they never
 * cover the data. The gutter takes up to a share of the width, but never breaks a word.
 */
function getGutter({ references, width }: { references: PlotVisual["references"]; width: number }) {
  if (references.length === 0) {
    return { room: 0, width: PADDING.right };
  }

  const labels = references.map(({ label }) => label);
  const widest = Math.max(...labels.map((label) => getLabelWidth(label)));
  const room = Math.max(Math.min(widest, width * MAX_GUTTER_SHARE), getWidestWord(labels));

  return { room, width: room + REFERENCE_INSET };
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
  references: ReferenceMark[];
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

export function getPlotLayout({
  formatX,
  formatY,
  visual,
  width,
}: {
  formatX: (value: number) => string;
  formatY: (value: number) => string;
  visual: PlotVisual;
  width: number;
}): PlotLayout {
  const axes = getPlotAxes(visual);
  const yTicks = axes.y.ticks.map((value) => ({ label: formatY(value), value }));
  const left = Math.max(PADDING.left, ...yTicks.map((tick) => getLabelWidth(tick.label)));
  const gutter = getGutter({ references: visual.references, width });
  const plotRight = Math.max(width - gutter.width, left + 1);
  const plotBottom = HEIGHT - PADDING.bottom;
  const marks = visual.series.map((item) => item.mark);

  const x = createLinearScale({ domain: axes.x.domain, range: [left, plotRight] });
  const y = createLinearScale({ domain: axes.y.domain, range: [plotBottom, PADDING.top] });

  const series = visual.series.map((item) =>
    item.points.map((point) => ({ x: x.toPixel(point.x), y: y.toPixel(point.y) })),
  );

  const references = getReferences({ references: visual.references, room: gutter.room, y });

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

  const { key, labels } = getPointLabels({
    named,
    scene: {
      bounds: { bottom: plotBottom, left, right: gutter.room > 0 ? plotRight : width, top: 0 },
      dots,
      segments: getSegments({ marks, references, series, x }),
    },
  });

  const xTicks = axes.x.ticks.map((value) => ({ label: formatX(value), value }));

  return {
    key,
    labels,
    left,
    plotBottom,
    plotRight,
    referenceLabelX: plotRight + REFERENCE_INSET,
    references,
    series,
    x,
    xTickY: plotBottom + AXIS_LABEL_OFFSET,
    xTicks: thinTicks({ start: left, ticks: xTicks, width, x }),
    y,
    yTicks,
  };
}
