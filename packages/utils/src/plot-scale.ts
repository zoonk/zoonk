import { formatLocalizedNumber, fractionDigitsFor } from "./localized-number";

export type NumericDomain = readonly [min: number, max: number];

export type LinearScale = {
  domain: NumericDomain;
  toValue: (position: number) => number;
  toPixel: (value: number) => number;
  range: NumericDomain;
};

/** A flat domain maps everything to the middle of the range. */
export function createLinearScale({
  domain,
  range,
}: {
  domain: NumericDomain;
  range: NumericDomain;
}): LinearScale {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0;

  return {
    domain,
    range,
    toPixel: (value) => (span === 0 ? (r0 + r1) / 2 : r0 + ((value - d0) / span) * (r1 - r0)),
    toValue: (position) => (r1 === r0 ? d0 : d0 + ((position - r0) / (r1 - r0)) * span),
  };
}

/* oxlint-disable-next-line no-magic-numbers -- These are the round steps themselves. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;
const DEFAULT_TICK_COUNT = 4;

function niceStep(span: number, count: number): number {
  if (span <= 0 || count <= 0) {
    return 1;
  }

  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const nice = NICE_STEPS.find((step) => step * magnitude >= rough) ?? NICE_STEPS.at(-1) ?? 1;

  return nice * magnitude;
}

function cleanFloat(value: number): number {
  return Number(value.toPrecision(12));
}

/** One whole unit for a whole number, else its own order of magnitude: 3 gives 2–4, 0.5 gives 0.4–0.6. */
function padFlat(value: number): NumericDomain {
  const pad = Number.isInteger(value) ? 1 : 10 ** Math.floor(Math.log10(Math.abs(value)));
  return [cleanFloat(value - pad), cleanFloat(value + pad)];
}

export function niceTicks(domain: NumericDomain, count = DEFAULT_TICK_COUNT): number[] {
  const [min, max] = domain;
  const step = niceStep(max - min, count);

  if (!Number.isFinite(step)) {
    return [];
  }

  const first = Math.ceil(cleanFloat(min / step)) * step;
  const total = Math.floor(cleanFloat((max - first) / step));

  return Array.from({ length: Math.max(total + 1, 0) }, (_, index) =>
    cleanFloat(first + index * step),
  );
}

/**
 * Starts at zero by default so bars and areas aren't exaggerated by a cropped axis; line charts of
 * data far from zero pass `includeZero: false`.
 */
export function niceDomain(
  values: readonly number[],
  {
    count = DEFAULT_TICK_COUNT,
    includeZero = true,
  }: { count?: number; includeZero?: boolean } = {},
): NumericDomain {
  const finite = values.filter((value) => Number.isFinite(value));
  const anchors = includeZero ? [0] : [];
  const low = Math.min(...anchors, ...finite);
  const high = Math.max(...anchors, ...finite);

  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return [0, 1];
  }

  if (low === high) {
    return includeZero ? [0, 1] : padFlat(low);
  }

  const step = niceStep(high - low, count);

  const rounded: NumericDomain = [
    cleanFloat(Math.floor(cleanFloat(low / step)) * step),
    cleanFloat(Math.ceil(cleanFloat(high / step)) * step),
  ];

  // Rounding out to a whole step can pass the largest number a double holds.
  return rounded.every((bound) => Number.isFinite(bound)) ? rounded : [low, high];
}

export function getChartValueAxis(chart: {
  axisStart: number | null;
  chart: "bar" | "line";
  series: readonly { values: readonly number[] }[];
}) {
  const values = chart.series.flatMap((series) => series.values);
  const anchors = chart.axisStart === null ? values : [...values, chart.axisStart];
  const nice = niceDomain(anchors, { includeZero: chart.chart === "bar" });
  const domain: NumericDomain = chart.axisStart === null ? nice : [chart.axisStart, nice[1]];
  const wholeNumbers = values.every((value) => Number.isInteger(value));
  const ticks = niceTicks(domain).filter((tick) => !wholeNumbers || Number.isInteger(tick));

  return { domain, ticks, values };
}

/* oxlint-disable-next-line no-magic-numbers -- These are the round steps themselves, largest first. */
const ROUND_FACTORS = [10, 5, 2, 1] as const;

/** The round step nearest `span / count` on a log scale, so ticks fill a span without running past it. */
function nearestStep(span: number, count: number): number {
  const rough = span / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));

  const factor =
    ROUND_FACTORS.find(
      (round, index) => rough / magnitude >= Math.sqrt(round * (ROUND_FACTORS[index + 1] ?? round)),
    ) ?? 1;

  return factor * magnitude;
}

function ticksWithin([min, max]: NumericDomain, step: number): number[] {
  if (!Number.isFinite(step) || step <= 0) {
    return [];
  }

  const first = Math.ceil(cleanFloat(min / step));
  const last = Math.floor(cleanFloat(max / step));

  return Array.from({ length: Math.max(last - first + 1, 0) }, (_, index) =>
    cleanFloat((first + index) * step),
  );
}

function wholeTicks(ticks: number[], values: number[]): number[] {
  const whole = values.every((value) => Number.isInteger(value));
  return ticks.filter((tick) => !whole || Number.isInteger(tick));
}

/**
 * The x axis spans the data and no further, so the points fill the plot; its round ticks sit
 * inside it. One x value sits in the middle.
 */
function getPlotXAxis(values: number[]) {
  const finite = values.filter((value) => Number.isFinite(value));
  const low = Math.min(...finite);
  const high = Math.max(...finite);

  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    return { domain: [0, 1] as NumericDomain, ticks: [0, 1] };
  }

  const domain = low === high ? padFlat(low) : ([low, high] as const);
  const ticks = ticksWithin(domain, nearestStep(domain[1] - domain[0], DEFAULT_TICK_COUNT));

  return { domain, ticks: wholeTicks(ticks, finite) };
}

function getPlotYAxis(values: number[]) {
  const domain = niceDomain(values, { includeZero: false });
  return { domain, ticks: wholeTicks(niceTicks(domain), values) };
}

export function getPlotAxes(plot: {
  references: readonly { y: number }[];
  series: readonly { points: readonly { x: number; y: number }[] }[];
}) {
  const points = plot.series.flatMap((series) => series.points);

  return {
    x: getPlotXAxis(points.map((point) => point.x)),
    y: getPlotYAxis([...points.map((point) => point.y), ...plot.references.map(({ y }) => y)]),
  };
}

const COMPACT_FROM = 10_000;
const COMPACT_FRACTION_DIGITS = 2;
const MAX_FRACTION_DIGITS = 20;

export function isLarge(values: readonly number[]): boolean {
  return values.some((value) => Math.abs(value) >= COMPACT_FROM);
}

function decimalsOf(step: number): number {
  const [, decimals = ""] = cleanFloat(step).toFixed(MAX_FRACTION_DIGITS).split(".");
  return decimals.replace(/0+$/u, "").length;
}

/**
 * Tick labels a learner reads on every platform: as many decimals as the step between ticks needs,
 * and large numbers shortened ("12.5K") only where every shortened tick stays exact, so no two ticks
 * print the same. The x axis groups digits only in large numbers, so years don't read as "2,024".
 */
export function formatTicks({
  axis,
  locale,
  ticks,
}: {
  axis: "x" | "y";
  locale: string;
  ticks: readonly number[];
}): string[] {
  const [first = 0, second] = ticks;
  const large = isLarge(ticks);
  const grouping = axis === "y" || large;
  const digits = second === undefined ? fractionDigitsFor(first) : decimalsOf(second - first);

  const format = (options: { compact: boolean; maximumFractionDigits: number }) =>
    ticks.map((value) => formatLocalizedNumber({ ...options, grouping, locale, value }));

  if (large) {
    const compact = format({ compact: true, maximumFractionDigits: COMPACT_FRACTION_DIGITS });
    const exact = format({ compact: true, maximumFractionDigits: MAX_FRACTION_DIGITS });

    if (compact.every((label, index) => label === exact[index])) {
      return compact;
    }
  }

  return format({ compact: false, maximumFractionDigits: digits });
}

const TICK_LABEL_GAP = 4;

export function fittingTickIndices(
  frames: readonly { left: number; right: number }[],
  gap = TICK_LABEL_GAP,
): number[] {
  const last = frames.length - 1;

  if (last < 1) {
    return frames.map((_, index) => index);
  }

  const strides = Array.from({ length: frames.length }, (_, index) => index + 1);

  const step =
    strides.find((stride) => {
      const kept = frames.filter((_, index) => index % stride === 0);

      return kept.every(
        (frame, index) => index === 0 || frame.left >= (kept[index - 1]?.right ?? 0) + gap,
      );
    }) ?? frames.length;

  return frames.flatMap((_, index) => (index % step === 0 ? [index] : []));
}

export function tickCounts(count = DEFAULT_TICK_COUNT): number[] {
  return Array.from({ length: count }, (_, index) => count - index);
}

export function fittingTicks({
  domain,
  frame,
  ticks = (count) => niceTicks(domain, count),
  count = DEFAULT_TICK_COUNT,
  gap = TICK_LABEL_GAP,
}: {
  domain: NumericDomain;
  frame: (value: number) => { left: number; right: number };
  ticks?: (count: number) => number[];
  count?: number;
  gap?: number;
}): number[] {
  for (const density of tickCounts(count)) {
    const values = ticks(density);
    const boxes = values.map((value) => frame(value));

    if (
      boxes.every((box, index) => index === 0 || box.left >= (boxes[index - 1]?.right ?? 0) + gap)
    ) {
      return values;
    }
  }

  return [];
}
