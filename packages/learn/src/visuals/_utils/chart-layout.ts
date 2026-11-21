import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import {
  type LinearScale,
  type NumericDomain,
  type TickFormatter,
  createLinearScale,
  fittingTickIndices,
  formatTicks,
  getChartValueAxis,
} from "@zoonk/utils/plot-scale";
import {
  type CategoryLabelLayout,
  type LabelWidth,
  type TextWidth,
  clampLabelCenter,
  estimateTextWidth,
  fitsUnderBars,
  getCategoryLabels,
  toLabelWidth,
  wrapLabel,
} from "./category-labels";

export const HEIGHT = 208;
export const PADDING = { bottom: 26, left: 48, right: 8, top: 22 } as const;
export const LABEL_GAP = 6;
export const LABEL_LINE_HEIGHT = 14;
export const AXIS_LABEL_OFFSET = 16;
export const BAR_THICKNESS = 14;
export const VALUE_GAP = 4;
export const GROUP_SHARE = 0.68;
export const BAR_GAP = 2;
const MIN_BAR_WIDTH = 4;
const BAR_SPACING = 2;
const NAME_GAP = 4;
const ROW_GAP = 12;
const ROWS_TOP = 2;
const MAX_VALUE_SHARE = 1 / 3;

type Tick = { label: string; value: number };

export type PlacedTick = Tick & { center: number };

type ValueAxis = { domain: NumericDomain; ticks: Tick[]; values: number[] };

export type ColumnLayout = {
  band: number;
  center: (index: number) => number;
  height: number;
  labels: CategoryLabelLayout;
  /** Where each name is centered: under its mark, moved in so it stays inside the chart. */
  labelCenters: number[];
  left: number;
  orientation: "vertical";
  y: LinearScale;
  yTicks: Tick[];
};

type BarRow = { barTops: number[]; bottom: number; lines: string[]; name: string; nameTop: number };

export type RowLayout = {
  gridBottom: number;
  gridTop: number;
  height: number;
  orientation: "horizontal";
  origin: number;
  rows: BarRow[];
  showValues: boolean;
  tickY: number;
  x: LinearScale;
  xTicks: PlacedTick[];
};

/** Values beside marks are drawn in medium weight. */
export function fitsLabel({
  label,
  room,
  textWidth = estimateTextWidth,
}: {
  label: string;
  room: number;
  textWidth?: TextWidth;
}): boolean {
  return textWidth(label, "medium") <= room;
}

/** Upright bars share their category's band, so each series thins them; past this they're slivers. */
function fitsBarsSideBySide({ band, seriesCount }: { band: number; seriesCount: number }): boolean {
  return (band * GROUP_SHARE) / seriesCount - BAR_GAP >= MIN_BAR_WIDTH;
}

function getWidestLabel(labels: string[], labelWidth: LabelWidth): number {
  return Math.max(0, ...labels.map((label) => labelWidth(label)));
}

function getValueRoom({
  formatValue,
  origin,
  textWidth,
  values,
}: {
  formatValue: (value: number) => string;
  origin: number;
  textWidth: TextWidth;
  values: number[];
}) {
  const valueWidth = toLabelWidth((text) => textWidth(text, "medium"));

  const widest = (side: number[]) =>
    getWidestLabel(
      side.map((value) => formatValue(value)),
      valueWidth,
    );

  return {
    left: widest(values.filter((value) => value < origin)),
    right: widest(values.filter((value) => value >= origin)),
  };
}

function getRowHeight({ lines, seriesCount }: { lines: string[]; seriesCount: number }) {
  const barsHeight = seriesCount * BAR_THICKNESS + (seriesCount - 1) * BAR_SPACING;
  return lines.length * LABEL_LINE_HEIGHT + NAME_GAP + barsHeight;
}

function placeRow({
  lines,
  name,
  nameTop,
  seriesCount,
}: {
  lines: string[];
  name: string;
  nameTop: number;
  seriesCount: number;
}): BarRow {
  const barsTop = nameTop + lines.length * LABEL_LINE_HEIGHT + NAME_GAP;

  const barTops = Array.from(
    { length: seriesCount },
    (_, index) => barsTop + index * (BAR_THICKNESS + BAR_SPACING),
  );

  const bottom = nameTop + getRowHeight({ lines, seriesCount });
  return { barTops, bottom, lines, name, nameTop };
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function placeRows({
  categories,
  labelWidth,
  seriesCount,
  width,
}: {
  categories: string[];
  labelWidth: LabelWidth;
  seriesCount: number;
  width: number;
}): BarRow[] {
  const names = categories.map((name) => ({
    lines: wrapLabel({ label: name, labelWidth, room: width }),
    name,
  }));

  const heights = names.map(({ lines }) => getRowHeight({ lines, seriesCount }) + ROW_GAP);

  return names.map(({ lines, name }, index) =>
    placeRow({ lines, name, nameTop: ROWS_TOP + sum(heights.slice(0, index)), seriesCount }),
  );
}

/** Keeps every Nth tick label, the fewest skipped that leaves none touching where they're drawn. */
function thinTicks({
  labelWidth,
  ticks,
  width,
  x,
}: {
  labelWidth: LabelWidth;
  ticks: Tick[];
  width: number;
  x: LinearScale;
}): PlacedTick[] {
  const placed = ticks.map((tick) => ({
    ...tick,
    center: clampLabelCenter({ labelWidth, lines: [tick.label], width, x: x.toPixel(tick.value) }),
  }));

  const bounds = placed.map(({ center, label }) => {
    const half = labelWidth(label) / 2;
    return { left: center - half, right: center + half };
  });

  const indices = fittingTickIndices(bounds, 0);
  return placed.filter((_, index) => indices.includes(index));
}

function getRowLayout({
  axis,
  formatValue,
  textWidth,
  visual,
  width,
}: {
  axis: ValueAxis;
  formatValue: (value: number) => string;
  textWidth: TextWidth;
  visual: ChartVisual;
  width: number;
}): RowLayout {
  const labelWidth = toLabelWidth(textWidth);
  const origin = Math.max(axis.domain[0], 0);
  const room = getValueRoom({ formatValue, origin, textWidth, values: axis.values });
  const showValues = Math.max(room.left, room.right) <= width * MAX_VALUE_SHARE;
  const range = showValues ? ([room.left, width - room.right] as const) : ([0, width] as const);
  const x = createLinearScale({ domain: axis.domain, range });

  const rows = placeRows({
    categories: visual.categories,
    labelWidth,
    seriesCount: visual.series.length,
    width,
  });

  const gridBottom = rows.at(-1)?.bottom ?? ROWS_TOP;
  const tickY = gridBottom + LABEL_GAP + LABEL_LINE_HEIGHT / 2;

  return {
    gridBottom,
    gridTop: ROWS_TOP,
    height: tickY + LABEL_LINE_HEIGHT / 2,
    orientation: "horizontal",
    origin,
    rows,
    showValues,
    tickY,
    x,
    xTicks: thinTicks({ labelWidth, ticks: axis.ticks, width, x }),
  };
}

/**
 * Lays out a category chart. `formatTick` prints one value tick in the chart's notation, and
 * `formatTicks` picks the decimals and the short form that keep every tick distinct. Labels are
 * measured with `textWidth`, estimated where the chart's font can't be measured.
 */
export function getLayout({
  formatTick,
  formatValue,
  textWidth = estimateTextWidth,
  visual,
  width,
}: {
  formatTick: TickFormatter;
  formatValue: (value: number) => string;
  textWidth?: TextWidth;
  visual: ChartVisual;
  width: number;
}): ColumnLayout | RowLayout {
  const { domain, ticks, values } = getChartValueAxis(visual);
  const labelWidth = toLabelWidth(textWidth);
  const tickLabels = formatTicks({ axis: "y", format: formatTick, ticks });

  const axis = {
    domain,
    ticks: ticks.map((value, index) => ({ label: tickLabels[index] ?? "", value })),
    values,
  };

  const left = getWidestLabel(tickLabels, labelWidth);
  const plotWidth = Math.max(width - left - PADDING.right, 1);
  const band = plotWidth / visual.categories.length;
  const labels = getCategoryLabels({ band, categories: visual.categories, labelWidth });

  const upright =
    fitsUnderBars(labels) && fitsBarsSideBySide({ band, seriesCount: visual.series.length });

  if (visual.chart === "bar" && !upright) {
    return getRowLayout({ axis, formatValue, textWidth, visual, width });
  }

  const lines = Math.max(...labels.lines.map((label) => label.length));
  const center = (index: number) => left + band * index + band / 2;

  return {
    band,
    center,
    height: HEIGHT + (lines - 1) * LABEL_LINE_HEIGHT,
    labelCenters: visual.categories.map((category, index) =>
      clampLabelCenter({
        labelWidth,
        lines: labels.lines[index] ?? [category],
        start: left,
        width,
        x: center(index),
      }),
    ),
    labels,
    left,
    orientation: "vertical",
    y: createLinearScale({ domain: axis.domain, range: [HEIGHT - PADDING.bottom, PADDING.top] }),
    yTicks: axis.ticks,
  };
}
