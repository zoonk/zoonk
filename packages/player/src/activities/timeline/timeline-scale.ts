import { niceTicks } from "@zoonk/utils/plot-scale";

/** Positions a year can take on a drag: about a hundred along the axis, in whole years. */
const POSITIONS = 100;
const TICK_COUNT = 5;
const ROUND_FROM = 100;
const SIGNIFICANT_DIGITS = 2;

/* oxlint-disable-next-line no-magic-numbers -- These are the round steps themselves. */
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000] as const;

/** A year as people write it: 30 BCE, 1969 CE, or just 1969 when the axis has no BCE. */
type YearLabel = { era: "bce" | "ce" | null; year: number };

/**
 * Years are whole numbers with negative ones BCE, so -30 is 30 BCE. Eras show only when the axis
 * reaches back before year 1, where "1000" alone would be ambiguous.
 */
export function yearLabel(year: number, axis: { start: number }): YearLabel {
  if (year < 0) {
    return { era: "bce", year: -year };
  }

  return { era: axis.start < 0 ? "ce" : null, year };
}

/** Round year ticks along the axis; year 0 is skipped because there was no year 0. */
export function yearTicks(start: number, end: number): number[] {
  return niceTicks([start, end], TICK_COUNT).filter((tick) => tick !== 0 && Number.isInteger(tick));
}

/** How far one drag or arrow step moves a year: a round step near a hundredth of the axis. */
export function yearStep(start: number, end: number): number {
  const rough = (end - start) / POSITIONS;
  return STEPS.find((step) => step >= rough) ?? STEPS.at(-1) ?? 1;
}

/**
 * Snaps a year to the drag step, measured from the start of the axis so both ends stay
 * reachable, and keeps it on the axis.
 */
export function snapYear(year: number, axis: { end: number; start: number }): number {
  const step = yearStep(axis.start, axis.end);
  const snapped = axis.start + Math.round((year - axis.start) / step) * step;
  return Math.min(Math.max(snapped, axis.start), axis.end);
}

/** A gap in years, rounded to two significant digits once it's large: "about 2,500 years". */
export function roundedGap(gap: number): number {
  const size = Math.abs(gap);

  if (size < ROUND_FROM) {
    return size;
  }

  return Number(size.toPrecision(SIGNIFICANT_DIGITS));
}

/** Years between two dates, with no year 0 between 1 BCE and 1 CE. */
export function yearsBetween(first: number, second: number): number {
  const [from, to] = first < second ? [first, second] : [second, first];
  return to - from - (from < 0 && to > 0 ? 1 : 0);
}

/**
 * Pushes labels apart along one axis so none overlap, keeping each as close to its own point as
 * it can and all of them between `top` and `bottom`. Returns positions in the input's order.
 */
export function spreadLabels({
  bottom,
  gap,
  positions,
  top,
}: {
  bottom: number;
  gap: number;
  positions: readonly number[];
  top: number;
}): number[] {
  const order = positions
    .map((position, index) => ({ index, position }))
    .toSorted((a, b) => a.position - b.position);

  /* Top to bottom, each label at least `gap` below the one above; then bottom to top, back inside. */
  const downward: number[] = [];

  for (const item of order) {
    const previous = downward.at(-1);
    downward.push(Math.max(item.position, top, previous === undefined ? top : previous + gap));
  }

  const upward = [...downward];

  for (const index of [...upward.keys()].toReversed()) {
    const next = upward[index + 1];

    upward[index] = Math.min(
      upward[index] ?? bottom,
      bottom,
      next === undefined ? bottom : next - gap,
    );
  }

  const byIndex = new Map(
    order.map((item, sorted) => [item.index, upward[sorted] ?? item.position]),
  );

  return positions.map((position, index) => byIndex.get(index) ?? position);
}

/**
 * The order the learner's placements put the events in: earliest first, ties in the order they
 * were placed. This is the answer the check grades.
 */
export function placedOrder(placements: readonly { id: string; year: number }[]): string[] {
  return placements
    .map((placement, index) => ({ ...placement, index }))
    .toSorted((a, b) => a.year - b.year || a.index - b.index)
    .map((placement) => placement.id);
}
