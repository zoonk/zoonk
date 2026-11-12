import { type ChartVisual } from "@zoonk/core/library/steps/contract";
import {
  type LinearScale,
  type NumericDomain,
  createLinearScale,
  niceDomain,
  niceTicks,
} from "@zoonk/utils/plot-scale";
import {
  type CategoryLabelLayout,
  clampLabelCenter,
  fitsUnderBars,
  getCategoryLabels,
  getLabelWidth,
  wrapLabel,
} from "./category-labels";

export const HEIGHT = 208;
export const PADDING = { bottom: 26, left: 48, right: 8, top: 22 } as const;
export const LABEL_GAP = 6;
export const LABEL_LINE_HEIGHT = 14;
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
const TICK_COUNT = 4;

type Tick = { label: string; value: number };

type ValueAxis = { domain: NumericDomain; ticks: Tick[]; values: number[] };

export type ColumnLayout = {
  band: number;
  center: (index: number) => number;
  height: number;
  labels: CategoryLabelLayout;
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
  xTicks: Tick[];
};

export function fitsLabel(label: string, room: number): boolean {
  return getLabelWidth(label) <= room + LABEL_GAP;
}

/** Upright bars share their category's band, so each series thins them; past this they're slivers. */
function fitsBarsSideBySide({ band, seriesCount }: { band: number; seriesCount: number }): boolean {
  return (band * GROUP_SHARE) / seriesCount - BAR_GAP >= MIN_BAR_WIDTH;
}

function getValueAxis({
  formatTick,
  visual,
}: {
  formatTick: (tick: number) => string;
  visual: ChartVisual;
}): ValueAxis {
  const values = visual.series.flatMap((series) => series.values);
  const anchors = visual.axisStart === null ? values : [...values, visual.axisStart];
  const nice = niceDomain(anchors, { includeZero: visual.chart === "bar" });

  const domain = visual.axisStart === null ? nice : ([visual.axisStart, nice[1]] as const);
  const wholeNumbers = values.every((value) => Number.isInteger(value));

  const ticks = niceTicks(domain, TICK_COUNT)
    .filter((tick) => !wholeNumbers || Number.isInteger(tick))
    .map((value) => ({ label: formatTick(value), value }));

  return { domain, ticks, values };
}

function getWidestLabel(labels: string[]): number {
  return Math.max(0, ...labels.map((label) => getLabelWidth(label)));
}

function getValueRoom({
  formatValue,
  origin,
  values,
}: {
  formatValue: (value: number) => string;
  origin: number;
  values: number[];
}) {
  return {
    left: getWidestLabel(
      values.filter((value) => value < origin).map((value) => formatValue(value)),
    ),
    right: getWidestLabel(
      values.filter((value) => value >= origin).map((value) => formatValue(value)),
    ),
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
  seriesCount,
  width,
}: {
  categories: string[];
  seriesCount: number;
  width: number;
}): BarRow[] {
  const names = categories.map((name) => ({
    lines: wrapLabel({ label: name, room: width }),
    name,
  }));

  const heights = names.map(({ lines }) => getRowHeight({ lines, seriesCount }) + ROW_GAP);

  return names.map(({ lines, name }, index) =>
    placeRow({ lines, name, nameTop: ROWS_TOP + sum(heights.slice(0, index)), seriesCount }),
  );
}

/** Keeps every Nth tick label, the fewest skipped that leaves none touching where they're drawn. */
function thinTicks({ ticks, width, x }: { ticks: Tick[]; width: number; x: LinearScale }): Tick[] {
  const bounds = ticks.map((tick) => {
    const center = clampLabelCenter({ lines: [tick.label], width, x: x.toPixel(tick.value) });
    const half = getLabelWidth(tick.label) / 2;
    return { left: center - half, right: center + half };
  });

  const step =
    bounds.findIndex((_, index) => {
      const kept = bounds.filter((__, tick) => tick % (index + 1) === 0);
      return kept.every((bound, at) => at === 0 || bound.left >= (kept[at - 1]?.right ?? 0));
    }) + 1;

  return ticks.filter((_, index) => index % Math.max(step, 1) === 0);
}

function getRowLayout({
  axis,
  formatValue,
  visual,
  width,
}: {
  axis: ValueAxis;
  formatValue: (value: number) => string;
  visual: ChartVisual;
  width: number;
}): RowLayout {
  const origin = Math.max(axis.domain[0], 0);
  const room = getValueRoom({ formatValue, origin, values: axis.values });
  const showValues = Math.max(room.left, room.right) <= width * MAX_VALUE_SHARE;
  const range = showValues ? ([room.left, width - room.right] as const) : ([0, width] as const);
  const x = createLinearScale({ domain: axis.domain, range });

  const rows = placeRows({
    categories: visual.categories,
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
    xTicks: thinTicks({ ticks: axis.ticks, width, x }),
  };
}

export function getLayout({
  formatTick,
  formatValue,
  visual,
  width,
}: {
  formatTick: (tick: number) => string;
  formatValue: (value: number) => string;
  visual: ChartVisual;
  width: number;
}): ColumnLayout | RowLayout {
  const axis = getValueAxis({ formatTick, visual });
  const left = Math.max(PADDING.left, getWidestLabel(axis.ticks.map((tick) => tick.label)));
  const plotWidth = Math.max(width - left - PADDING.right, 1);
  const band = plotWidth / visual.categories.length;
  const labels = getCategoryLabels({ band, categories: visual.categories });

  const upright =
    fitsUnderBars(labels) && fitsBarsSideBySide({ band, seriesCount: visual.series.length });

  if (visual.chart === "bar" && !upright) {
    return getRowLayout({ axis, formatValue, visual, width });
  }

  const lines = Math.max(...labels.lines.map((label) => label.length));

  return {
    band,
    center: (index) => left + band * index + band / 2,
    height: HEIGHT + (lines - 1) * LABEL_LINE_HEIGHT,
    labels,
    left,
    orientation: "vertical",
    y: createLinearScale({ domain: axis.domain, range: [HEIGHT - PADDING.bottom, PADDING.top] }),
    yTicks: axis.ticks,
  };
}
